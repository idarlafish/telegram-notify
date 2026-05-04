import { useNavigate } from "@tanstack/react-router";
import { useBackButton } from "../lib/telegram";
import css from "./PrivacyPage.module.css";

export default function PrivacyPage() {
  const navigate = useNavigate();
  useBackButton(() => navigate({ to: "/" }));

  return (
    <article className={css.page}>
      <h1>Privacy Policy</h1>
      <p className={css.meta}>Sleepy Notify — last updated 2026-05-04</p>

      <p>
        This policy describes how Sleepy Notify handles your data. It supplements — and does not
        replace —{" "}
        <a href="https://telegram.org/tos/mini-apps" target="_blank" rel="noopener noreferrer">
          Telegram&apos;s Mini Apps Terms of Service
        </a>
        , which apply to every Mini App you use inside Telegram, including this one.
      </p>

      <h2>What we store</h2>
      <p>
        When you send <code>/start</code>, we store your Telegram user ID and chat ID so the bot can
        deliver reminders to you. When you create a reminder, we store its time, recurrence pattern,
        timezone, and message text.
      </p>
      <p>
        That is the entire dataset. We do not collect your name, contact list, location, or any
        other Telegram metadata.
      </p>

      <h2>How it&apos;s protected</h2>
      <p>
        Reminder messages are encrypted at the application layer (AES-256-GCM with a per-record
        initialization vector) before being written to the database. The encryption key is held only
        by the deployed Worker, not in the database. Storage itself is Cloudflare Durable Object
        SQLite which is also encrypted at rest by Cloudflare.
      </p>

      <h2>Where it&apos;s stored</h2>
      <p>
        In Cloudflare Durable Object SQLite — one isolated database per Telegram user, hosted on
        Cloudflare&apos;s infrastructure. No copies are exported to other providers.
      </p>

      <h2>Who can see it</h2>
      <p>
        Only the bot operator (via Cloudflare account access) and Cloudflare itself as the
        infrastructure provider. We never sell, share, or use your data for advertising, analytics,
        or model training.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Until you delete it. Reminders persist until you remove them in the Mini App. Sending{" "}
        <code>/stop</code> to the bot erases your account and every reminder you&apos;ve created —
        immediately, with no grace period.
      </p>

      <h2>Your rights</h2>
      <ul>
        <li>
          <strong>Delete everything:</strong> send <code>/stop</code> to the bot.
        </li>
        <li>
          <strong>Delete a single reminder:</strong> tap it in the Mini App, then Delete.
        </li>
        <li>
          <strong>Questions or requests:</strong>{" "}
          {(() => {
            const email = import.meta.env.VITE_PRIVACY_CONTACT_EMAIL;
            return email ? (
              <a href={`mailto:${email}`}>{email}</a>
            ) : (
              <span>[CONFIGURE_ME — set VITE_PRIVACY_CONTACT_EMAIL]</span>
            );
          })()}
          .
        </li>
      </ul>

      <h2>Changes</h2>
      <p>
        If this policy changes, the &quot;last updated&quot; date above will reflect it. Material
        changes will be announced via a bot message.
      </p>
    </article>
  );
}
