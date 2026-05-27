import { Building2, Home, Phone, Search, Users } from "lucide-react";
import { createUnit, createUnitsBatch } from "@/app/actions";
import { FeedbackQueryCleanup } from "@/app/feedback-query-cleanup";
import { DropdownSelect } from "@/app/dropdown-select";
import { resolveCondominiumContext } from "@/lib/condominiums";
import { listResidents, listUnits } from "@/lib/residents";
import { UnitDisclosureCard } from "@/app/moradores/unit-disclosure-card";

type ResidentsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getConfiguredBlockType(towerPrefix: string | null | undefined) {
  const normalized = towerPrefix?.trim().toLowerCase();

  if (normalized?.startsWith("bloco")) {
    return "bloco" as const;
  }

  return "torre" as const;
}

function getFloorBounds(floorsPerTower: number | null | undefined, floorStart: number | null | undefined) {
  if (typeof floorsPerTower !== "number" || typeof floorStart !== "number") {
    return null;
  }

  return {
    min: floorStart,
    max: floorStart + floorsPerTower - 1,
  };
}

export default async function ResidentsPage({ searchParams }: ResidentsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const feedbackMessage = getSingleParam(resolvedSearchParams.message)?.trim() ?? "";
  const feedbackTone = getSingleParam(resolvedSearchParams.tone);
  const queryParam = getSingleParam(resolvedSearchParams.q)?.trim().toLowerCase() ?? "";
  const { activeCondominium } = await resolveCondominiumContext();
  const configuredBlockType = getConfiguredBlockType(activeCondominium?.tower_prefix);
  const floorBounds = getFloorBounds(activeCondominium?.floors_per_tower, activeCondominium?.floor_start);
  const maxTowerLetter =
    activeCondominium?.tower_count && activeCondominium.tower_naming === "letters"
      ? String.fromCharCode(65 + activeCondominium.tower_count - 1)
      : "";
  const blockLetterPattern = maxTowerLetter ? `^[A-${maxTowerLetter}]$` : undefined;
  const [units, residents] = await Promise.all([
    listUnits(100, activeCondominium?.id),
    listResidents(100, activeCondominium?.id),
  ]);
  const residentsByUnitId = new Map<string, typeof residents>();
  residents.forEach((resident) => {
    if (!resident.unit_id) {
      return;
    }

    const currentResidents = residentsByUnitId.get(resident.unit_id) ?? [];
    currentResidents.push(resident);
    residentsByUnitId.set(resident.unit_id, currentResidents);
  });
  const filteredUnits = queryParam
    ? units.filter((unit) =>
        [
          unit.label,
          unit.block ?? "",
          unit.floor ?? "",
          ...(residentsByUnitId.get(unit.id) ?? []).flatMap((resident) => [
            resident.full_name,
            resident.phone ?? "",
            resident.email ?? "",
          ]),
        ].some((value) =>
          value.toLowerCase().includes(queryParam),
        ),
      )
    : units;
  const occupiedUnitIds = new Set(residents.map((resident) => resident.unit_id).filter(Boolean));
  const vacantUnits = units.filter((unit) => !occupiedUnitIds.has(unit.id));
  const residentsWithoutWhatsapp = residents.filter((resident) => !resident.phone?.trim());

  return (
    <main className="pageShell">
      <header className="pageHeader">
        <h1>Moradores</h1>
        {activeCondominium ? <span className="pageContextTag">{activeCondominium.name}</span> : null}
      </header>

      {feedbackMessage ? (
        <section
          className={`feedbackBanner${feedbackTone === "error" ? " feedbackBannerError" : " feedbackBannerSuccess"}`}
        >
          <strong>{feedbackTone === "error" ? "Erro operacional" : "Operacao concluida"}</strong>
          <p>{feedbackMessage}</p>
        </section>
      ) : null}
      <FeedbackQueryCleanup />

      {!activeCondominium ? (
        <section className="emptyState">
          <strong>Nenhum condomínio ativo</strong>
        </section>
      ) : (
        <>
          {units.length === 0 ? (
            <section className="panel onboardingPanel">
              <div className="panelHeader">
                <div>
                  <h2>Configuração inicial das unidades</h2>
                </div>
              </div>

              <form action={createUnitsBatch} className="deliveryForm">
                <input type="hidden" name="condominiumId" value={activeCondominium.id} />

                <div className="fieldRow">
                  <label className="field">
                    <span>Quantidade de torres</span>
                    <input name="towersCount" type="number" min="1" max="20" defaultValue="1" required />
                  </label>

                  <label className="field">
                    <span>Andares por torre</span>
                    <input name="floorsPerTower" type="number" min="1" max="80" defaultValue="10" required />
                  </label>
                </div>

                <div className="fieldRow">
                  <label className="field">
                    <span>Apartamentos por andar</span>
                    <input name="unitsPerFloor" type="number" min="1" max="30" defaultValue="4" required />
                  </label>

                  <label className="field">
                    <span>Andar inicial</span>
                    <input name="floorStart" type="number" min="0" max="200" defaultValue="1" required />
                  </label>
                </div>

                <div className="fieldRow">
                  <label className="field">
                    <span>Nomenclatura das torres</span>
                    <DropdownSelect
                      name="towerNaming"
                      defaultValue="letters"
                      options={[
                        { value: "letters", label: "Letras: A, B, C..." },
                        { value: "numbers", label: "Números: 1, 2, 3..." },
                      ]}
                    />
                  </label>

                  <label className="field">
                    <span>Prefixo das torres</span>
                    <input name="towerPrefix" maxLength={20} placeholder="Ex.: Torre" defaultValue="Torre" />
                  </label>
                </div>

                <div className="fieldRow fieldRowSingle">
                  <label className="field">
                    <span>Formato das unidades</span>
                    <DropdownSelect
                      name="unitPattern"
                      defaultValue="compact-floor-unit"
                      options={[
                        { value: "compact-floor-unit", label: "Compacto: 121, 122, 123..." },
                        { value: "floor-sequence", label: "Com zero no apto: 1201, 1202..." },
                        { value: "padded-floor-sequence", label: "Andar com zero: 0101, 0102..." },
                      ]}
                    />
                  </label>
                </div>

                <button className="primaryButton" type="submit">
                  Gerar unidades automaticamente
                </button>
              </form>
            </section>
          ) : null}

          <section className="metricsGrid">
            <article className="metricCard">
              <div className="metricIcon metricAccentBlue">
                <Home size={18} />
              </div>
              <span className="metricValue">{units.length}</span>
              <span className="metricLabel">Unidades totais</span>
            </article>

            <article className="metricCard">
              <div className="metricIcon metricAccentGreen">
                <Users size={18} />
              </div>
              <span className="metricValue">{occupiedUnitIds.size}</span>
              <span className="metricLabel">Unidades com morador</span>
            </article>

            <article className="metricCard">
              <div className="metricIcon metricAccentAmber">
                <Building2 size={18} />
              </div>
              <span className="metricValue">{vacantUnits.length}</span>
              <span className="metricLabel">Unidades sem morador</span>
            </article>

            <article className="metricCard">
              <div className="metricIcon metricAccentRose">
                <Phone size={18} />
              </div>
              <span className="metricValue">{residentsWithoutWhatsapp.length}</span>
              <span className="metricLabel">Moradores sem WhatsApp</span>
            </article>
          </section>

          <section className="panel">
            <div className="panelHeader">
              <div>
                <h2>Busca operacional</h2>
              </div>
            </div>

            <form className="queueToolbar residentsToolbar" action="/moradores">
              <label className="toolbarSearch">
                <Search size={16} />
                <input
                  type="search"
                  name="q"
                  defaultValue={queryParam}
                  maxLength={120}
                  placeholder="Buscar por unidade, bloco, morador, WhatsApp ou e-mail"
                />
              </label>

              <button className="ghostButton toolbarButton" type="submit">
                Buscar
              </button>
            </form>
          </section>

          <section className="contentGrid residentsContentGrid">
            <div className="stackGrid">
              <div className="panel">
                <div className="panelHeader">
                  <div>
                    <h2>Nova unidade</h2>
                  </div>
                </div>

                <form action={createUnit} className="deliveryForm">
                  <input type="hidden" name="condominiumId" value={activeCondominium.id} />
                  <div className="unitInlineGrid unitCreateGrid">
                    <label className="field compactField">
                      <span>Tipo</span>
                      <DropdownSelect
                        name="blockType"
                        defaultValue={configuredBlockType}
                        disabled={Boolean(activeCondominium?.tower_prefix)}
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
                        placeholder="Ex.: 8"
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
                        placeholder="Ex.: 804"
                        required
                      />
                    </label>

                    <button className="primaryButton unitInlineSave" type="submit">
                      Cadastrar unidade
                    </button>
                  </div>
                </form>
              </div>
            </div>

            <div className="stackGrid">
              <div className="panel">
                <div className="panelHeader">
                  <div>
                    <h2>Unidades cadastradas</h2>
                  </div>
                </div>

                {filteredUnits.length === 0 ? (
                  <div className="emptyState">
                    <strong>Nenhuma unidade encontrada</strong>
                  </div>
                ) : (
                  <div className="unitDisclosureList">
                    {filteredUnits.map((unit) => {
                      const unitResidents = residentsByUnitId.get(unit.id) ?? [];

                      return (
                        <UnitDisclosureCard
                          key={unit.id}
                          condominiumId={activeCondominium.id}
                          layoutConfig={activeCondominium}
                          unit={unit}
                          residents={unitResidents}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>

          {residents.length === 0 && units.length === 0 ? (
            <div className="emptyState">
              <strong>Base operacional ainda vazia</strong>
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}
