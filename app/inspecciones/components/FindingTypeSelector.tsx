import { AlertTriangle, BadgeX } from "lucide-react";
import InspectionOptionCard from "./InspectionOptionCard";

type FindingTypeSelectorProps = {
  onSelectAnomaly: () => void;
  onSelectNonConformity: () => void;
};

export default function FindingTypeSelector({
  onSelectAnomaly,
  onSelectNonConformity,
}: FindingTypeSelectorProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <InspectionOptionCard
        title="Anormalidad"
        description={
          "Característica anormal que requiere consultar " +
          "o registrar una decisión."
        }
        icon={AlertTriangle}
        onClick={onSelectAnomaly}
      />

      <InspectionOptionCard
        title="Rechazo por SPEC"
        description={
          "Registro para trazabilidad de las muestras " +
          "rechazadas por especificación."
        }
        icon={BadgeX}
        onClick={onSelectNonConformity}
      />
    </div>
  );
}
