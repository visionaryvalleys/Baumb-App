import type { Metadata } from "next";
import { LegalDoc } from "@/components/legal-doc";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <LegalDoc title="Privacy" updated="9 October 2026">
      <p>BAUMB is a training and food journal operated from India. This notice explains what the account stores and who else sees a meal estimate. It is written for the Digital Personal Data Protection Act, 2023.</p>
      <h2 className="text-lg text-white">What you give us</h2>
      <p>Your name, email, and a password. The password is stored as a one-way scrypt hash. We cannot read it. You also give body details, a goal, meals, workouts, weight, injuries and conditions. Those records are health-related. They are used to run your journal and are not sold.</p>
      <h2 className="text-lg text-white">Meal estimates</h2>
      <p>When you ask for an estimate, the sentence you typed, and a photo if you added one, is sent to the model provider configured for this deployment: Google Gemini, OpenAI, or Anthropic. The photo is not saved on BAUMB. The numbers are saved only after you tap Add. If no model key is configured, that request is refused and nothing is sent.</p>
      <p>Progress photos you choose to keep are a separate store. They stay in private object storage until you delete them or you delete the account.</p>
      <h2 className="text-lg text-white">Account and security</h2>
      <p>A single httpOnly session cookie keeps you signed in. Sign-in and the journal are sent over HTTPS in production. Database queries use parameters. Sign-up, sign-in and meal estimates are rate limited. The journal itself is in Postgres. We do not use it for advertising.</p>
      <h2 className="text-lg text-white">How long, and how to erase it</h2>
      <p>The journal stays while the account is open. In Settings you can delete the account. That removes the user, the session, the journal and stored progress photos. A board score tied to the account goes with it. Payment records are not kept, because BAUMB does not take card payments.</p>
      <h2 className="text-lg text-white">Your rights</h2>
      <p>You can see and correct most of the journal yourself. You can delete the account. You can withdraw the meal-estimate consent by stopping use of Estimate and deleting the account. To ask for a copy or to raise a complaint, write to the address in the app settings. We aim to answer within 30 days. These terms are governed by the laws of India.</p>
    </LegalDoc>
  );
}
