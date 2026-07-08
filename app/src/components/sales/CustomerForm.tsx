import { Input, Field } from "@/components/ui/input";

/** Müşteri bilgileri — CRM yok; ad/telefon satış kaydına bağlanır. */
export function CustomerForm({
  name,
  phone,
  note,
  onName,
  onPhone,
  onNote,
}: {
  name: string;
  phone: string;
  note: string;
  onName: (v: string) => void;
  onPhone: (v: string) => void;
  onNote: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Müşteri Ad Soyad">
        <Input value={name} onChange={(e) => onName(e.target.value)} placeholder="Opsiyonel" />
      </Field>
      <Field label="Telefon">
        <Input
          value={phone}
          onChange={(e) => onPhone(e.target.value.replace(/[^\d\s+]/g, ""))}
          placeholder="05xx xxx xx xx"
          inputMode="tel"
        />
      </Field>
      <Field label="Not" className="col-span-2">
        <Input value={note} onChange={(e) => onNote(e.target.value)} placeholder="Opsiyonel" />
      </Field>
    </div>
  );
}
