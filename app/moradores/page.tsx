import { Building2, Home, Mail, Phone, Search, Users } from "lucide-react";
import {
  createResident,
  createUnit,
  createUnitsBatch,
  toggleResidentActive,
  toggleUnitActive,
  updateResident,
  updateUnit,
} from "@/app/actions";
import { DropdownSelect } from "@/app/dropdown-select";
import { PhoneInput } from "@/app/form-fields";
import { resolveCondominiumContext } from "@/lib/condominiums";
import { listResidents, listUnits } from "@/lib/residents";

type ResidentsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ResidentsPage({ searchParams }: ResidentsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const feedbackMessage = getSingleParam(resolvedSearchParams.message)?.trim() ?? "";
  const feedbackTone = getSingleParam(resolvedSearchParams.tone);
  const queryParam = getSingleParam(resolvedSearchParams.q)?.trim().toLowerCase() ?? "";
  const { activeCondominium } = await resolveCondominiumContext();
  const [units, residents] = await Promise.all([
    listUnits(100, activeCondominium?.id),
    listResidents(100, activeCondominium?.id),
  ]);
  const filteredUnits = queryParam
    ? units.filter((unit) =>
        [unit.label, unit.block ?? "", unit.floor ?? ""].some((value) =>
          value.toLowerCase().includes(queryParam),
        ),
      )
    : units;
  const filteredResidents = queryParam
    ? residents.filter((resident) =>
        [
          resident.full_name,
          resident.phone ?? "",
          resident.email ?? "",
          resident.units?.label ?? "",
          resident.units?.block ?? "",
        ].some((value) => value.toLowerCase().includes(queryParam)),
      )
    : residents;
  const occupiedUnitIds = new Set(residents.map((resident) => resident.unit_id).filter(Boolean));
  const residentsByUnitId = new Map(
    residents
      .filter((resident) => resident.unit_id)
      .map((resident) => [resident.unit_id, resident]),
  );
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
                  <div className="fieldRow">
                    <label className="field">
                      <span>Unidade</span>
                      <input name="label" maxLength={20} placeholder="Ex.: 804B" required />
                    </label>

                    <label className="field">
                      <span>Bloco</span>
                      <input name="block" maxLength={40} placeholder="Ex.: Torre A" />
                    </label>
                  </div>

                  <label className="field">
                    <span>Andar</span>
                    <input name="floor" maxLength={40} placeholder="Ex.: 8" />
                  </label>

                  <button className="primaryButton" type="submit">
                    Cadastrar unidade
                  </button>
                </form>
              </div>

              <div className="panel">
                <div className="panelHeader">
                  <div>
                    <h2>Novo morador</h2>
                  </div>
                </div>

                {units.length === 0 ? (
                  <div className="emptyState">
                    <strong>Nenhuma unidade cadastrada</strong>
                  </div>
                ) : (
                  <form action={createResident} className="deliveryForm">
                    <input type="hidden" name="condominiumId" value={activeCondominium.id} />
                    <label className="field">
                      <span>Nome completo</span>
                      <input name="fullName" maxLength={120} placeholder="Ex.: Ana Martins" required />
                    </label>

                    <div className="fieldRow">
                      <label className="field">
                        <span>WhatsApp</span>
                        <PhoneInput name="phone" placeholder="Ex.: (11) 99999-0000" />
                      </label>

                      <label className="field">
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

                    <label className="field">
                      <span>Unidade</span>
                      <DropdownSelect
                        name="unitId"
                        defaultValue=""
                        placeholder="Selecione uma unidade"
                        options={[
                          { value: "", label: "Selecione uma unidade" },
                          ...units.map((unit) => ({
                            value: unit.id,
                            label: `${unit.label}${unit.block ? ` • ${unit.block}` : ""}${unit.floor ? ` • ${unit.floor}º andar` : ""}`,
                          })),
                        ]}
                        required
                      />
                    </label>

                    <button className="primaryButton" type="submit">
                      Cadastrar morador
                    </button>
                  </form>
                )}
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
                      const resident = residentsByUnitId.get(unit.id);

                      return (
                        <details key={unit.id} className="unitDisclosure">
                          <summary className="unitSummary">
                            <span className="metricIcon metricAccentBlue">
                              <Home size={16} />
                            </span>
                            <strong>{unit.label}</strong>
                            <span>{unit.block ?? "Sem bloco"}</span>
                            <span>{unit.floor ? `${unit.floor}º andar` : "Andar nao informado"}</span>
                            {resident ? (
                              <span className="inlineMutedPill">{resident.full_name}</span>
                            ) : (
                              <span className="inlineWarning">Sem morador</span>
                            )}
                          </summary>

                          <div className="unitDisclosureBody">
                            {resident ? (
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
                              </div>
                            ) : (
                              <form action={createResident} className="inlineForm unitResidentForm">
                                <input type="hidden" name="condominiumId" value={activeCondominium.id} />
                                <input type="hidden" name="unitId" value={unit.id} />
                                <label className="field compactField">
                                  <span>Morador responsável</span>
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
                                <div className="inlineFormActions">
                                  <button className="secondaryButton" type="submit">
                                    Cadastrar morador
                                  </button>
                                </div>
                              </form>
                            )}

                            <form action={updateUnit} className="inlineForm">
                              <input type="hidden" name="condominiumId" value={activeCondominium.id} />
                              <input type="hidden" name="id" value={unit.id} />
                              <div className="fieldRow">
                                <label className="field compactField">
                                  <span>Unidade</span>
                                  <input name="label" maxLength={20} defaultValue={unit.label} required />
                                </label>
                                <label className="field compactField">
                                  <span>Bloco</span>
                                  <input name="block" maxLength={40} defaultValue={unit.block ?? ""} />
                                </label>
                              </div>
                              <label className="field compactField">
                                <span>Andar</span>
                                <input name="floor" maxLength={40} defaultValue={unit.floor ?? ""} />
                              </label>
                              <div className="inlineFormActions">
                                <button className="secondaryButton" type="submit">
                                  Salvar unidade
                                </button>
                              </div>
                            </form>

                            <form action={toggleUnitActive} className="inlineFormActions">
                              <input type="hidden" name="condominiumId" value={activeCondominium.id} />
                              <input type="hidden" name="id" value={unit.id} />
                              <input type="hidden" name="nextState" value={unit.is_active ? "false" : "true"} />
                              <button className="ghostButton" type="submit">
                                {unit.is_active ? "Inativar unidade" : "Reativar unidade"}
                              </button>
                            </form>
                          </div>
                        </details>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="panel">
                <div className="panelHeader">
                  <div>
                    <h2>Moradores cadastrados</h2>
                  </div>
                </div>

                {filteredResidents.length === 0 ? (
                  <div className="emptyState">
                    <strong>Nenhum morador encontrado</strong>
                  </div>
                ) : (
                  <div className="stackGrid residentGrid">
                    {filteredResidents.map((resident) => (
                      <article key={resident.id} className="panel residentCard">
                        <div className="residentCardTop">
                          <span className="metricIcon metricAccentBlue">
                            <Users size={16} />
                          </span>
                          <span className="residentUnit">
                            {resident.units?.label ? `Unidade ${resident.units.label}` : "Sem unidade"}
                          </span>
                        </div>
                        <h2>{resident.full_name}</h2>
                        <div className="residentMeta">
                          <span>
                            <Phone size={15} />
                            {resident.phone ?? "Sem WhatsApp informado"}
                          </span>
                          {!resident.phone?.trim() ? (
                            <span className="inlineWarning">Contato pendente</span>
                          ) : null}
                          <span>
                            <Mail size={15} />
                            {resident.email ?? "Sem e-mail informado"}
                          </span>
                          {resident.units ? (
                            <span>
                              <Building2 size={15} />
                              {[resident.units.block, resident.units.floor ? `${resident.units.floor}º andar` : null]
                                .filter(Boolean)
                                .join(" • ") || "Unidade vinculada"}
                            </span>
                          ) : null}
                          {!resident.is_active ? (
                            <span className="inlineMutedPill">Inativo</span>
                          ) : null}
                        </div>

                        <form action={updateResident} className="inlineForm">
                          <input type="hidden" name="condominiumId" value={activeCondominium.id} />
                          <input type="hidden" name="id" value={resident.id} />
                          <label className="field compactField">
                            <span>Nome</span>
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
                          <label className="field compactField">
                            <span>Unidade</span>
                            <DropdownSelect
                              name="unitId"
                              defaultValue={resident.unit_id ?? ""}
                              placeholder="Selecione uma unidade"
                              options={[
                                { value: "", label: "Selecione uma unidade" },
                                ...units.map((unit) => ({
                                  value: unit.id,
                                  label: `${unit.label}${unit.block ? ` • ${unit.block}` : ""}${unit.floor ? ` • ${unit.floor}º andar` : ""}`,
                                })),
                              ]}
                              required
                            />
                          </label>
                          <div className="inlineFormActions">
                            <button className="secondaryButton" type="submit">
                              Salvar morador
                            </button>
                          </div>
                        </form>

                        <form action={toggleResidentActive} className="inlineFormActions">
                          <input type="hidden" name="condominiumId" value={activeCondominium.id} />
                          <input type="hidden" name="id" value={resident.id} />
                          <input type="hidden" name="nextState" value={resident.is_active ? "false" : "true"} />
                          <button className="ghostButton" type="submit">
                            {resident.is_active ? "Inativar morador" : "Reativar morador"}
                          </button>
                        </form>
                      </article>
                    ))}
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
