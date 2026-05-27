import {
  Bell,
  CheckCircle2,
  Filter,
  PackagePlus,
  Package,
  Settings2,
  Search,
  ShieldCheck,
  Truck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { DropdownSelect } from "@/app/dropdown-select";
import { FeedbackQueryCleanup } from "@/app/feedback-query-cleanup";
import { RecentDeliveriesList } from "@/app/recent-deliveries-list";
import { resolveCondominiumContext } from "@/lib/condominiums";
import {
  deliveryStatuses,
  getDeliveryMetrics,
  listRecentDeliveries,
} from "@/lib/deliveries";

export const dynamic = "force-dynamic";

const shortcutCards = [
  {
    href: "/nova-encomenda",
    title: "Nova encomenda",
    icon: PackagePlus,
  },
  {
    href: "/moradores",
    title: "Moradores",
    icon: Users,
  },
  {
    href: "/historico",
    title: "Histórico",
    icon: Bell,
  },
  {
    href: "/configuracoes",
    title: "Configurações",
    icon: Settings2,
  },
] as const;

const metricCards = [
  {
    key: "total",
    label: "Últimos registros",
    accentClass: "metricAccentBlue",
    icon: Package,
  },
  {
    key: "pending",
    label: "Pendentes",
    accentClass: "metricAccentAmber",
    icon: Truck,
  },
  {
    key: "notified",
    label: "Avisados",
    accentClass: "metricAccentBlue",
    icon: Bell,
  },
  {
    key: "pickedUp",
    label: "Retirados",
    accentClass: "metricAccentGreen",
    icon: CheckCircle2,
  },
  {
    key: "cancelled",
    label: "Cancelados",
    accentClass: "metricAccentRose",
    icon: ShieldCheck,
  },
] as const;

type HomeProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type DeliveryStatusFilter = (typeof deliveryStatuses)[number] | "all";

const deliveryStatusFilters = [...deliveryStatuses, "all"] as const;

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isDeliveryStatusFilter(value: string | undefined): value is DeliveryStatusFilter {
  return !!value && deliveryStatusFilters.includes(value as DeliveryStatusFilter);
}

export default async function Home({ searchParams }: HomeProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const statusParam = getSingleParam(resolvedSearchParams.status);
  const queryParam = getSingleParam(resolvedSearchParams.q)?.trim() ?? "";
  const feedbackMessage = getSingleParam(resolvedSearchParams.message)?.trim() ?? "";
  const feedbackTone = getSingleParam(resolvedSearchParams.tone);
  const activeStatus: DeliveryStatusFilter = isDeliveryStatusFilter(statusParam)
    ? statusParam
    : "all";
  const { activeCondominium } = await resolveCondominiumContext();
  let recentDeliveries = [] as Awaited<ReturnType<typeof listRecentDeliveries>>;
  let metrics = {
    total: 0,
    pending: 0,
    notified: 0,
    pickedUp: 0,
    cancelled: 0,
  };
  let dataError: string | null = null;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  if (activeCondominium) {
    try {
      [recentDeliveries, metrics] = await Promise.all([
        listRecentDeliveries(12, {
          condominiumId: activeCondominium.id,
          query: queryParam,
          status: activeStatus,
        }),
        getDeliveryMetrics(activeCondominium.id),
      ]);
    } catch (error) {
      dataError =
        error instanceof Error
          ? error.message
          : "Falha inesperada ao consultar o banco.";
    }
  }
  return (
    <main className="pageShell">
      {!activeCondominium ? (
        <section className="emptyState">
          <strong>Nenhum condomínio ativo</strong>
        </section>
      ) : null}

      {feedbackMessage ? (
        <section
          className={`feedbackBanner${feedbackTone === "error" ? " feedbackBannerError" : " feedbackBannerSuccess"}`}
        >
          <strong>{feedbackTone === "error" ? "Erro operacional" : "Operacao concluida"}</strong>
          <p>{feedbackMessage}</p>
        </section>
      ) : null}
      <FeedbackQueryCleanup />

      {activeCondominium ? (
        <>
          <section className="heroPanel">
            <div className="heroCopy">
              <span className="heroTag">{greeting}</span>
              <h2>Bem-vindo ao painel operacional.</h2>
              <p>
                Visualize o condomínio, acompanhe pendências, encontre moradores e execute ações
                rápidas sem sair da tela principal.
              </p>

              <div className="heroActions">
                <Link href="/nova-encomenda" className="primaryButton heroPrimaryAction">
                  Registrar nova encomenda
                </Link>
                <Link href="/historico" className="ghostButton heroSecondaryAction">
                  Ver auditoria completa
                </Link>
              </div>
            </div>

            <div className="heroSnapshot">
              <div className="heroSnapshotCard heroSnapshotCardAccent">
                <span className="heroSnapshotLabel">Pendências em aberto</span>
                <strong>{metrics.pending}</strong>
                <p>
                  {metrics.pending > 0
                    ? "Itens aguardando contato ou retirada."
                    : "Nenhuma encomenda travada na fila."}
                </p>
              </div>
            </div>
          </section>

          <section className="metricsGrid">
            {metricCards.map(({ key, label, accentClass, icon: Icon }) => (
              <article key={key} className="metricCard">
                <div className={`metricIcon ${accentClass}`}>
                  <Icon size={18} />
                </div>
                <span className="metricValue">{metrics[key]}</span>
                <span className="metricLabel">{label}</span>
              </article>
            ))}
          </section>

          <section className="contentGrid">
            <div className="panel formPanel">
              <div className="panelHeader">
                <div>
                  <h2>Atalhos operacionais</h2>
                </div>
              </div>

              <div className="shortcutGrid">
                {shortcutCards.map(({ href, title, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="shortcutCard"
                  >
                    <span className="metricIcon metricAccentBlue">
                      <Icon size={16} />
                    </span>
                    <h3>{title}</h3>
                  </Link>
                ))}
              </div>
            </div>

            <div className="panel queuePanel">
              <div className="panelHeader">
                <div>
                  <h2>Últimas encomendas</h2>
                </div>
              </div>

              <form className="queueToolbar" action="/">
                <input type="hidden" name="condominiumId" value={activeCondominium.id} />
                <label className="toolbarSearch">
                  <Search size={16} />
                  <input
                    type="search"
                    name="q"
                    defaultValue={queryParam}
                    maxLength={120}
                    placeholder="Buscar por morador, unidade ou transportadora"
                  />
                </label>

                <DropdownSelect
                  name="status"
                  defaultValue={activeStatus}
                  icon={<Filter size={16} />}
                  options={[
                    { value: "all", label: "Todos os status" },
                    { value: "pending", label: "Pendentes" },
                    { value: "notified", label: "Avisados" },
                    { value: "picked_up", label: "Retirados" },
                    { value: "cancelled", label: "Cancelados" },
                  ]}
                />

                <button className="ghostButton toolbarButton" type="submit">
                  Aplicar filtros
                </button>
              </form>

              {dataError ? (
                <div className="emptyState">
                  <strong>Banco ainda não pronto para leitura</strong>
                  <p>{dataError}</p>
                  <p>
                    Verifique as variáveis de ambiente e a conectividade do backend com o
                    projeto Supabase configurado.
                  </p>
                </div>
              ) : recentDeliveries.length === 0 ? (
                <div className="emptyState">
                  <strong>Nenhuma encomenda encontrada</strong>
                  <p>
                    {queryParam || activeStatus !== "all"
                      ? "Ajuste os filtros para ampliar a busca na fila operacional."
                      : "Use o formulário ao lado para registrar o primeiro recebimento."}
                  </p>
                </div>
              ) : (
                <RecentDeliveriesList
                  deliveries={recentDeliveries}
                  condominiumId={activeCondominium.id}
                />
              )}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
