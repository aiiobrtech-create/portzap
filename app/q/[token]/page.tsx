import Image from "next/image";
import { notFound } from "next/navigation";
import { getAppBaseUrl } from "@/lib/app-url";
import { getPickupTokenByValue } from "@/lib/pickup-tokens";
import { buildPickupValidationUrl, buildQrImageUrl, isPickupExpired } from "@/lib/pickups";

type PickupQrPageProps = {
  params: Promise<{ token: string }>;
};

export default async function PickupQrPage({ params }: PickupQrPageProps) {
  const { token } = await params;
  const [pickup, baseUrl] = await Promise.all([
    getPickupTokenByValue(token),
    getAppBaseUrl(),
  ]);

  if (!pickup) {
    notFound();
  }

  const validationUrl = buildPickupValidationUrl(baseUrl, pickup.token_value);
  const qrImageUrl = buildQrImageUrl(validationUrl);
  const isExpired = pickup.status === "expired" || isPickupExpired(pickup.expires_at);
  const isUsed = pickup.status === "used";
  const isCancelled = pickup.status === "cancelled";

  return (
    <main className="authPage">
      <section className="authCard authCardWide">
        <div className="authHeader">
          <span className="sectionEyebrow">Retirada digital</span>
          <h1>QR da encomenda</h1>
        </div>

        {isUsed ? (
          <section className="feedbackBanner feedbackBannerSuccess">
            <strong>Retirada já concluída</strong>
          </section>
        ) : null}

        {isExpired ? (
          <section className="feedbackBanner feedbackBannerError">
            <strong>QR expirado</strong>
          </section>
        ) : null}

        {isCancelled ? (
          <section className="feedbackBanner feedbackBannerError">
            <strong>QR invalidado</strong>
          </section>
        ) : null}

        <div className="pickupResidentCard">
          {!(isUsed || isExpired || isCancelled) ? (
            <Image
              src={qrImageUrl}
              alt="QR code de retirada"
              className="pickupQrImage"
              width={280}
              height={280}
              unoptimized
            />
          ) : null}

          <div className="stackGrid">
            <strong>{pickup.delivery?.resident_name ?? "Morador não identificado"}</strong>
            <p>
              Unidade {pickup.delivery?.apartment ?? "não informada"}
              {pickup.delivery?.carrier ? ` • ${pickup.delivery.carrier}` : ""}
            </p>
            {pickup.delivery?.description ? <p>{pickup.delivery.description}</p> : null}
            <p>
              Validade:{" "}
              {new Intl.DateTimeFormat("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
              }).format(new Date(pickup.expires_at))}
            </p>
            <code className="pickupTokenCode">{pickup.token_value}</code>
          </div>
        </div>
      </section>
    </main>
  );
}
