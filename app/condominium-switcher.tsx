import { Building2 } from "lucide-react";
import { DropdownSelect } from "@/app/dropdown-select";
import type { CondominiumRecord } from "@/lib/condominiums";

type CondominiumSwitcherProps = {
  condominiums: CondominiumRecord[];
  activeCondominiumId?: string;
};

export function CondominiumSwitcher({
  condominiums,
  activeCondominiumId,
}: CondominiumSwitcherProps) {
  if (condominiums.length === 0) {
    return null;
  }

  return (
    <form className="condominiumSwitcher" method="get">
      <DropdownSelect
        name="condominiumId"
        defaultValue={activeCondominiumId}
        icon={<Building2 size={16} />}
        options={condominiums.map((condominium) => ({
          value: condominium.id,
          label: condominium.name,
        }))}
      />
      <button className="ghostButton toolbarButton" type="submit">
        Trocar
      </button>
    </form>
  );
}
