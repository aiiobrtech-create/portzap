import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
loadEnvFile(path.resolve(currentDir, "..", ".env"));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const confirmClear = process.env.CONFIRM_CLEAR;
const bucketName = process.env.SUPABASE_DELIVERY_PHOTOS_BUCKET ?? "delivery-photos";

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar definidos.");
}

if (confirmClear !== "YES") {
  throw new Error("Defina CONFIRM_CLEAR=YES para executar a limpeza.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function deleteAllRows(tableName) {
  const { error } = await supabase.from(tableName).delete().not("id", "is", null);

  if (error) {
    throw new Error(`Falha ao limpar ${tableName}: ${error.message}`);
  }
}

async function clearStorageBucket(name) {
  const removed = [];
  const queue = [""];

  while (queue.length > 0) {
    const prefix = queue.pop();
    const { data, error } = await supabase.storage.from(name).list(prefix, {
      limit: 1000,
      sortBy: { column: "name", order: "asc" },
    });

    if (error) {
      if (error.message.toLowerCase().includes("bucket")) {
        return;
      }

      throw new Error(`Falha ao listar objetos do bucket ${name}: ${error.message}`);
    }

    for (const entry of data ?? []) {
      const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id) {
        removed.push(fullPath);
      }

      if (entry.metadata?.mimetype === null && !entry.id) {
        queue.push(fullPath);
      }
    }
  }

  if (removed.length === 0) {
    return;
  }

  const { error } = await supabase.storage.from(name).remove(removed);
  if (error) {
    throw new Error(`Falha ao limpar o bucket ${name}: ${error.message}`);
  }
}

async function deleteAllAuthUsers() {
  const usersToDelete = [];
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw new Error(`Falha ao listar usuários do Auth: ${error.message}`);
    }

    const users = data?.users ?? [];
    if (users.length === 0) {
      break;
    }

    usersToDelete.push(...users.map((user) => user.id));

    if (users.length < 1000) {
      break;
    }

    page += 1;
  }

  for (const userId of usersToDelete) {
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) {
      throw new Error(`Falha ao remover usuário do Auth ${userId}: ${error.message}`);
    }
  }

  return usersToDelete.length;
}

async function ensureDefaultCondominium() {
  const { error } = await supabase
    .from("condominiums")
    .upsert(
      {
        name: "Condominio Padrao",
        slug: "condominio-padrao",
        is_active: true,
      },
      { onConflict: "slug" },
    );

  if (error) {
    throw new Error(`Falha ao garantir condomínio padrão: ${error.message}`);
  }
}

async function main() {
  const tablesInOrder = [
    "delivery_status_history",
    "notification_attempts",
    "delivery_pickup_tokens",
    "deliveries",
    "residents",
    "units",
    "operator_memberships",
    "operator_users",
    "condominiums",
  ];

  console.log("Limpando dados de teste...");

  for (const tableName of tablesInOrder) {
    await deleteAllRows(tableName);
    console.log(`- ${tableName}: ok`);
  }

  const removedAuthUsers = await deleteAllAuthUsers();
  console.log(`- auth.users: ${removedAuthUsers} usuário(s) removido(s)`);

  await clearStorageBucket(bucketName);
  console.log(`- storage bucket ${bucketName}: ok`);

  await ensureDefaultCondominium();
  console.log("- condomínio padrão: ok");

  console.log("Limpeza concluída.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
