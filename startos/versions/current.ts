import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  // The upstream version this build descends from, plus this package's
  // revision. The image is pinned to a post-1.9.2 main-branch commit (see
  // startos/manifest/index.ts), so the base stays 1.9.2 until upstream tags a
  // release that contains it.
  version: '1.9.2:2',
  releaseNotes: {
    en_US:
      'Security update. A settings, onboarding or Today page left open can no longer write to — or read the status of — an account that signed in after it in the same browser. A refused form no longer spends the one-time value on a two-factor setup or recovery-code page. Outbound reminder webhooks get Go 1.27.3 (CVE-2026-111943, a certificate chain that could accept an untrusted intermediate) and a certificate store that no longer trusts the compromised eMudhra authority.',
    es_ES:
      'Actualización de seguridad. Una página de ajustes, de incorporación o de Hoy que quede abierta ya no puede escribir en una cuenta que haya iniciado sesión después en el mismo navegador, ni leer su estado. Un formulario rechazado ya no gasta el valor de un solo uso de la página de doble factor o de código de recuperación. Los webhooks de recordatorio salientes incorporan Go 1.27.3 (CVE-2026-111943, una cadena de certificados que podía aceptar un intermedio no confiable) y un almacén de certificados que ya no confía en la autoridad eMudhra comprometida.',
    de_DE:
      'Sicherheitsupdate. Eine offen gelassene Einstellungs-, Einrichtungs- oder Heute-Seite kann nicht mehr in ein Konto schreiben, das sich danach im selben Browser angemeldet hat, und dessen Status nicht mehr lesen. Ein abgewiesenes Formular verbraucht den Einmalwert der Seite für Zwei-Faktor-Einrichtung oder Wiederherstellungscode nicht mehr. Ausgehende Erinnerungs-Webhooks erhalten Go 1.27.3 (CVE-2026-111943, eine Zertifikatskette, die ein nicht vertrauenswürdiges Zwischenzertifikat akzeptieren konnte) und einen Zertifikatsspeicher, der der kompromittierten Zertifizierungsstelle eMudhra nicht mehr vertraut.',
    pl_PL:
      'Aktualizacja bezpieczeństwa. Pozostawiona otwarta strona ustawień, wdrożenia lub Dzisiaj nie może już zapisywać na koncie, które zalogowało się po niej w tej samej przeglądarce, ani czytać jego stanu. Odrzucony formularz nie zużywa już jednorazowej wartości ze strony konfiguracji dwuetapowej ani kodu odzyskiwania. Wychodzące webhooki przypomnień otrzymują Go 1.27.3 (CVE-2026-111943, łańcuch certyfikatów mógł przyjąć niezaufany certyfikat pośredni) oraz magazyn certyfikatów, który nie ufa już skompromitowanemu urzędowi eMudhra.',
    fr_FR:
      'Mise à jour de sécurité. Une page de réglages, d’intégration ou Aujourd’hui laissée ouverte ne peut plus écrire dans un compte connecté après elle dans le même navigateur, ni lire son état. Un formulaire refusé ne consomme plus la valeur à usage unique de la page de double authentification ou de code de récupération. Les webhooks de rappel sortants bénéficient de Go 1.27.3 (CVE-2026-111943, une chaîne de certificats pouvait accepter un intermédiaire non fiable) et d’un magasin de certificats qui ne fait plus confiance à l’autorité eMudhra compromise.',
  },
  migrations: {
    up: async ({ effects }) => {},
    // Upstream documents downgrade caveats: a database that has been through a
    // newer release's migrations is not guaranteed readable by an older one.
    down: IMPOSSIBLE,
  },
})
