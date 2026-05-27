"use client";

import { useActionState, useMemo, useState } from "react";
import { createDelivery, type DeliveryActionState } from "@/app/actions";
import { DropdownSelect } from "@/app/dropdown-select";
import { FilePicker } from "@/app/file-picker";
import { PhoneInput } from "@/app/form-fields";
import { SubmitButton } from "@/app/submit-button";
import { carrierOptions } from "@/lib/carriers";

type NewDeliveryFormProps = {
  condominiumId: string;
  residents: Array<{
    id: string;
    full_name: string;
    phone: string | null;
    email: string | null;
    unit_id: string | null;
    is_active: boolean;
    units?: { label: string } | null;
  }>;
  units: Array<{
    id: string;
    label: string;
    block: string | null;
    floor: string | null;
  }>;
};

const initialState: DeliveryActionState = {
  tone: "idle",
  message: "",
};

export function NewDeliveryForm({ condominiumId, residents, units }: NewDeliveryFormProps) {
  const [state, formAction] = useActionState(createDelivery, initialState);
  const values = state.values;
  const initialUnitId = values?.unitId ?? "";
  const [selectedUnitId, setSelectedUnitId] = useState(initialUnitId);
  const [linkResidentToUnit, setLinkResidentToUnit] = useState(values?.linkResidentToUnit ?? true);
  const [selectedResidentId, setSelectedResidentId] = useState(values?.residentId ?? "");
  const selectedUnit = units.find((unit) => unit.id === selectedUnitId) ?? null;
  const selectedResidents = useMemo(
    () => residents.filter((resident) => resident.unit_id === selectedUnitId),
    [residents, selectedUnitId],
  );
  const selectedResident = useMemo(() => {
    if (selectedResidentId) {
      return selectedResidents.find((resident) => resident.id === selectedResidentId) ?? null;
    }

    return selectedResidents[0] ?? null;
  }, [selectedResidentId, selectedResidents]);
  const selectedRecordKey = selectedResident?.id ?? (selectedUnitId || "manual");
  const residentNameValue = values?.residentName || selectedResident?.full_name || "";
  const residentPhoneValue = values?.residentPhone || selectedResident?.phone || "";
  const packageRecipientNameValue = values?.packageRecipientName || selectedResident?.full_name || "";
  const apartmentValue = values?.apartment || selectedUnit?.label || "";

  return (
    <form key={state.formKey ?? "initial"} action={formAction} className="deliveryForm">
      <input type="hidden" name="condominiumId" value={condominiumId} />
      <input type="hidden" name="redirectPath" value="/nova-encomenda" />
      {linkResidentToUnit && selectedResidents.length > 1 ? (
        <label className="field">
          <span>Morador vinculado</span>
          <DropdownSelect
            name="residentId"
            value={selectedResident?.id ?? ""}
            placeholder="Selecione um morador"
            onValueChange={setSelectedResidentId}
            options={[
              { value: "", label: "Selecione um morador" },
              ...selectedResidents.map((resident) => ({
                value: resident.id,
                label: resident.full_name,
              })),
            ]}
          />
        </label>
      ) : (
        <input type="hidden" name="residentId" value={linkResidentToUnit ? selectedResident?.id ?? "" : ""} />
      )}

      {state.tone === "error" && state.message ? (
        <section className="feedbackBanner feedbackBannerError" aria-live="polite">
          <strong>Erro operacional</strong>
          <p>{state.message}</p>
        </section>
      ) : null}

      <label className="field">
        <span>Unidade disponível</span>
        <DropdownSelect
          name="unitId"
          value={selectedUnitId}
          placeholder="Selecionar unidade"
          onValueChange={setSelectedUnitId}
          options={[
            { value: "", label: "Selecionar unidade" },
            ...units.map((unit) => ({
              value: unit.id,
              label: `${unit.label}${unit.block ? ` • ${unit.block}` : ""}${unit.floor ? ` • ${unit.floor}º andar` : ""}`,
            })),
          ]}
        />
      </label>

      {selectedUnit ? (
        <div className="inlineMutedPill">
          {selectedResidents.length === 0
            ? "Unidade sem morador cadastrado"
            : selectedResidents.length === 1
              ? `Morador vinculado: ${selectedResidents[0].full_name}`
              : `Moradores vinculados: ${selectedResidents.length}`}
        </div>
      ) : null}

      {selectedResidents.length > 1 ? <div className="inlineMutedPill">Selecione o morador vinculado abaixo.</div> : null}

      <div className="fieldRow">
        <label className="field">
          <span>Morador responsável</span>
          <input
            name="residentName"
            key={`resident-name-${selectedRecordKey}`}
            defaultValue={residentNameValue}
            maxLength={120}
            placeholder="Ex.: Ana Martins"
          />
        </label>

        <label className="field">
          <span>WhatsApp</span>
          <PhoneInput
            name="residentPhone"
            key={`resident-phone-${selectedRecordKey}`}
            defaultValue={residentPhoneValue}
            placeholder="Ex.: (11) 99999-0000"
          />
        </label>
      </div>

      <label className="field">
        <span>Nome no pacote/remetente</span>
        <input
          name="packageRecipientName"
          key={`package-recipient-${selectedRecordKey}`}
          defaultValue={packageRecipientNameValue}
          maxLength={120}
          placeholder="Ex.: Ana Martins, Loja XPTO"
        />
      </label>

      <div className="fieldRow">
        <label className="field">
          <span>Unidade manual</span>
          <input
            name="apartment"
            key={`apartment-${selectedUnitId || "manual"}`}
            defaultValue={apartmentValue}
            maxLength={20}
            placeholder="Ex.: 804B"
          />
        </label>

        <label className="field checkField">
          <input
            type="checkbox"
            name="linkResidentToUnit"
            checked={linkResidentToUnit}
            onChange={(event) => setLinkResidentToUnit(event.currentTarget.checked)}
            disabled={!selectedUnitId}
          />
          <span>
            {selectedResident
              ? "Encomenda vinculada ao morador existente"
              : "Criar/vincular morador a esta unidade"}
          </span>
        </label>
      </div>

      <div className="fieldRow">
        <label className="field">
          <span>Transportadora</span>
          <DropdownSelect
            name="carrier"
            defaultValue={values?.carrier ?? ""}
            placeholder="Selecionar transportadora"
            options={[
              { value: "", label: "Selecionar transportadora" },
              ...carrierOptions.map((carrier) => ({ value: carrier, label: carrier })),
            ]}
          />
        </label>

        <label className="field">
          <span>Status inicial</span>
          <DropdownSelect
            name="status"
            defaultValue={values?.status ?? "notified"}
            options={[
              { value: "pending", label: "Pendente" },
              { value: "notified", label: "Avisado" },
              { value: "cancelled", label: "Cancelado" },
            ]}
          />
        </label>
      </div>

      <div className="fieldHintRow" aria-hidden="true">
        <div />
        <small className="fieldHint">
          Avisado envia o WhatsApp com o QR/código de retirada automaticamente.
        </small>
      </div>

      <label className="field">
        <span>Título da encomenda</span>
        <input
          name="description"
          defaultValue={values?.description ?? ""}
          maxLength={240}
          placeholder="Ex.: Caixa pequena, documento, medicamento, refeição"
        />
      </label>

      <label className="field">
        <span>Observações</span>
        <textarea
          name="internalNotes"
          defaultValue={values?.internalNotes ?? ""}
          rows={5}
          maxLength={1000}
          placeholder="Ex.: entregue às 14h, exige refrigeração, deixar na portaria interna"
        />
      </label>

      <FilePicker name="photo" label="Foto da encomenda" />

      <SubmitButton
        idleLabel="Cadastrar encomenda completa"
        pendingLabel="Salvando cadastro..."
      />
    </form>
  );
}
