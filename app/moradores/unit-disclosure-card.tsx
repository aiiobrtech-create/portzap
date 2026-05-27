"use client";

import { useState } from "react";
import { Building2, Home, Mail, Phone, Plus, Users } from "lucide-react";
import {
  createResident,
  toggleResidentActive,
  toggleUnitActive,
  updateResident,
  updateUnit,
} from "@/app/actions";
import { DropdownSelect } from "@/app/dropdown-select";
import { PhoneInput } from "@/app/form-fields";

type ResidentItem = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
};

type UnitDisclosureCardProps = {
  condominiumId: string;
  layoutConfig?: {
    tower_count: number | null;
    floors_per_tower: number | null;
    tower_naming: "letters" | "numbers" | null;
    tower_prefix: string | null;
    floor_start: number | null;
  } | null;
  unit: {
    id: string;
    label: string;
    block: string | null;
    floor: string | null;
    is_active: boolean;
  };
  residents: ResidentItem[];
};

function formatUnitContext(block: string | null, floor: string | null) {
  return [block, floor ? `${floor}º andar` : null].filter(Boolean).join(" • ") || "Sem detalhes";
}

function parseBlock(block: string | null) {
  const normalizedBlock = block?.trim() ?? "";
  const match = normalizedBlock.match(/^(Torre|Bloco)\s+([A-Za-z])$/i);

  if (!match) {
    return {
      blockType: "torre" as const,
      blockLetter: "",
    };
  }

  return {
    blockType: match[1].toLowerCase() === "torre" ? ("torre" as const) : ("bloco" as const),
    blockLetter: match[2].toUpperCase(),
  };
}

function getTowerToken(index: number, naming: "letters" | "numbers") {
  if (naming === "numbers") {
    return String(index + 1);
  }

  let current = index;
  let token = "";

  do {
    token = String.fromCharCode(65 + (current % 26)) + token;
    current = Math.floor(current / 26) - 1;
  } while (current >= 0);

  return token;
}

function getConfiguredBlockType(towerPrefix: string | null | undefined) {
  const normalized = towerPrefix?.trim().toLowerCase();

  if (normalized?.startsWith("bloco")) {
    return "bloco" as const;
  }

  return "torre" as const;
}

function getFloorBounds(layoutConfig: UnitDisclosureCardProps["layoutConfig"]) {
  if (
    !layoutConfig ||
    typeof layoutConfig.floors_per_tower !== "number" ||
    typeof layoutConfig.floor_start !== "number"
  ) {
    return null;
  }

  return {
    min: layoutConfig.floor_start,
    max: layoutConfig.floor_start + layoutConfig.floors_per_tower - 1,
  };
}

function formatResidentSummary(residents: ResidentItem[]) {
  if (residents.length === 0) {
    return "Sem morador";
  }

  if (residents.length === 1) {
    return residents[0].full_name;
  }

  return `${residents[0].full_name} +${residents.length - 1}`;
}

export function UnitDisclosureCard({ condominiumId, layoutConfig, unit, residents }: UnitDisclosureCardProps) {
  const [activePanel, setActivePanel] = useState<
    { kind: "unit" } | { kind: "addResident" } | { kind: "resident"; residentId: string } | null
  >(null);
  const unitContext = formatUnitContext(unit.block, unit.floor);
  const residentSummary = formatResidentSummary(residents);
  const isUnitEditing = activePanel?.kind === "unit";
  const isAddingResident = activePanel?.kind === "addResident";
  const blockFields = parseBlock(unit.block);
  const configuredBlockType = getConfiguredBlockType(layoutConfig?.tower_prefix);
  const floorBounds = getFloorBounds(layoutConfig);
  const maxTowerLetter =
    layoutConfig?.tower_count && layoutConfig.tower_naming === "letters"
      ? getTowerToken(layoutConfig.tower_count - 1, "letters")
      : "";
  const blockLetterPattern = maxTowerLetter ? `^[A-${maxTowerLetter}]$` : undefined;
  const blockLetterPlaceholder = maxTowerLetter ? `A-${maxTowerLetter}` : "A";

  return (
    <details className="unitDisclosure">
      <summary className="unitSummary">
        <span className="metricIcon metricAccentBlue">
          <Home size={16} />
        </span>
        <span className="unitSummaryMain">
          <strong>{`Unidade ${unit.label}`}</strong>
          <span>{residentSummary}</span>
        </span>
        <span className="unitSummaryAction">Abrir</span>
      </summary>

      <div className="unitDisclosureBody">
        <div className="unitSummaryMeta">
          <span>{unitContext}</span>
          {residents.length > 0 ? (
            <span className="inlineMutedPill">{residents.length === 1 ? "Morador vinculado" : `${residents.length} moradores`}</span>
          ) : (
            <span className="inlineWarning">Sem morador</span>
          )}
        </div>

        <div className="unitFixedInfo">
          <div className="residentMeta unitResidentMeta">
            <span>
              <Building2 size={15} />
              {unitContext}
            </span>
            <span>
              <Users size={15} />
              {residents.length === 0
                ? "Nenhum morador cadastrado"
                : `${residents.length} morador${residents.length > 1 ? "es" : ""} vinculado${residents.length > 1 ? "s" : ""}`}
            </span>
          </div>

          <div className="unitActionsRow">
            <button
              type="button"
              className="secondaryButton"
              onClick={() =>
                setActivePanel((current) => (current?.kind === "unit" ? null : { kind: "unit" }))
              }
            >
              Editar unidade
            </button>

            <button
              type="button"
              className="secondaryButton"
              onClick={() =>
                setActivePanel((current) => (current?.kind === "addResident" ? null : { kind: "addResident" }))
              }
            >
              <Plus size={16} />
              Adicionar morador
            </button>

            <form action={toggleUnitActive}>
              <input type="hidden" name="condominiumId" value={condominiumId} />
              <input type="hidden" name="id" value={unit.id} />
              <input type="hidden" name="nextState" value={unit.is_active ? "false" : "true"} />
              <button className={`ghostButton${unit.is_active ? " dangerButton" : ""}`} type="submit">
                {unit.is_active ? "Inativar unidade" : "Reativar unidade"}
              </button>
            </form>
          </div>
        </div>

        {isUnitEditing ? (
          <div className="unitEditPanel">
            <div className="unitSectionHeader">
              <span className="unitSectionLabel">Edição da unidade</span>
            </div>
            {unit.is_active ? <div className="unitDangerNote">Inativar esta unidade pode afetar novas encomendas e vínculos operacionais.</div> : null}
            <form action={updateUnit} className="inlineForm">
              <input type="hidden" name="condominiumId" value={condominiumId} />
              <input type="hidden" name="id" value={unit.id} />
              <div className="unitInlineGrid">
                <label className="field compactField">
                  <span>Tipo</span>
                  <DropdownSelect
                    name="blockType"
                    defaultValue={layoutConfig ? configuredBlockType : blockFields.blockType}
                    disabled={Boolean(layoutConfig?.tower_prefix)}
                    options={[
                      { value: "torre", label: "Torre" },
                      { value: "bloco", label: "Bloco" },
                    ]}
                  />
                </label>
                <label className="field compactField">
                  <span>Letra</span>
                  <input
                    className="uppercaseInput"
                    name="blockLetter"
                    maxLength={1}
                    defaultValue={blockFields.blockLetter}
                    pattern={blockLetterPattern}
                    placeholder="A"
                    required
                  />
                </label>
                <label className="field compactField">
                  <span>Andar</span>
                  <input
                    name="floor"
                    type="number"
                    min={floorBounds?.min ?? 0}
                    max={floorBounds?.max ?? 200}
                    step="1"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    defaultValue={unit.floor ?? ""}
                    required
                  />
                </label>
                <label className="field compactField">
                  <span>Unidade</span>
                  <input
                    name="unitNumber"
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    defaultValue={unit.label}
                    required
                  />
                </label>
                <button className="secondaryButton unitInlineSave" type="submit">
                  Salvar unidade
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {isAddingResident ? (
          <div className="unitEditPanel">
            <div className="unitSectionHeader">
              <span className="unitSectionLabel">Novo morador</span>
            </div>
            <form action={createResident} className="inlineForm">
              <input type="hidden" name="condominiumId" value={condominiumId} />
              <input type="hidden" name="unitId" value={unit.id} />
              <label className="field compactField">
                <span>Morador</span>
                <input name="fullName" maxLength={120} placeholder="Ex.: Ana Martins" required />
              </label>
              <div className="fieldRow">
                <label className="field compactField">
                  <span>WhatsApp</span>
                  <PhoneInput name="phone" placeholder="Ex.: (11) 99999-0000" />
                </label>
                <label className="field compactField">
                  <span>E-mail</span>
                  <input
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    maxLength={120}
                    placeholder="Ex.: ana@email.com"
                  />
                </label>
              </div>
              <div className="unitActionsRow">
                <button className="secondaryButton" type="submit">
                  Cadastrar morador
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {residents.length > 0 ? (
          <div className="unitResidentSection">
            <div className="unitSectionHeader">
              <span className="unitSectionLabel">Moradores vinculados</span>
            </div>
            <div className="unitResidentList">
              {residents.map((resident) => {
                const isEditingResident =
                  activePanel?.kind === "resident" && activePanel.residentId === resident.id;

                return (
                  <article key={resident.id} className="unitResidentCard">
                    <div className="unitResidentCardTop">
                      <div className="residentMeta unitResidentMeta">
                        <span>
                          <Users size={15} />
                          {resident.full_name}
                        </span>
                        <span>
                          <Phone size={15} />
                          {resident.phone ?? "Sem WhatsApp informado"}
                        </span>
                        <span>
                          <Mail size={15} />
                          {resident.email ?? "Sem e-mail informado"}
                        </span>
                        {!resident.is_active ? <span className="inlineMutedPill">Inativo</span> : null}
                      </div>

                      <button
                        type="button"
                        className="ghostButton unitInlineAction"
                        onClick={() =>
                          setActivePanel((current) =>
                            current?.kind === "resident" && current.residentId === resident.id
                              ? null
                              : { kind: "resident", residentId: resident.id },
                          )
                        }
                      >
                        Editar
                      </button>
                    </div>

                    {isEditingResident ? (
                      <form action={updateResident} className="inlineForm">
                        <input type="hidden" name="condominiumId" value={condominiumId} />
                        <input type="hidden" name="id" value={resident.id} />
                        <label className="field compactField">
                          <span>Morador</span>
                          <input name="fullName" maxLength={120} defaultValue={resident.full_name} required />
                        </label>
                        <div className="fieldRow">
                          <label className="field compactField">
                            <span>WhatsApp</span>
                            <PhoneInput name="phone" defaultValue={resident.phone ?? ""} />
                          </label>
                          <label className="field compactField">
                            <span>E-mail</span>
                            <input
                              name="email"
                              type="email"
                              inputMode="email"
                              autoComplete="email"
                              maxLength={120}
                              defaultValue={resident.email ?? ""}
                            />
                          </label>
                        </div>
                        <div className="unitActionsRow">
                          <button className="secondaryButton" type="submit">
                            Salvar morador
                          </button>
                          <input type="hidden" name="condominiumId" value={condominiumId} />
                          <input type="hidden" name="id" value={resident.id} />
                          <input type="hidden" name="nextState" value={resident.is_active ? "false" : "true"} />
                          <button className="ghostButton" type="submit" formAction={toggleResidentActive}>
                            {resident.is_active ? "Inativar morador" : "Reativar morador"}
                          </button>
                        </div>
                      </form>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </details>
  );
}
