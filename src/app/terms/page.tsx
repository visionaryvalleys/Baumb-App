import type { Metadata } from "next";
import { LegalDoc } from "@/components/legal-doc";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <LegalDoc title="Terms" updated="9 October 2026">
      <p>These terms are an agreement between you and BAUMB. By creating an account you agree to them and to the privacy notice. They are governed by the laws of India, and the courts of India have jurisdiction, without taking away a mandatory consumer right where you live.</p>
      <h2 className="text-lg text-white">Who can join</h2>
      <p>You must be 16 or older. If you are under 18, a parent or guardian should read these terms with you. One account each. You are responsible for the password and for what is logged under it.</p>
      <h2 className="text-lg text-white">What the journal does</h2>
      <p>BAUMB stores your training and meals and estimates a described meal or a photograph when you ask. The estimate is produced by a model. It is not a measurement and it is not medical advice. You choose Add before anything is written into the day. You can edit or delete a logged meal afterwards.</p>
      <h2 className="text-lg text-white">Your content</h2>
      <p>The journal remains yours. You allow BAUMB to store it, to send a meal description or photo to the configured model provider when you request an estimate, and to show it back to you. We do not sell it.</p>
      <h2 className="text-lg text-white">Closing the account</h2>
      <p>Settings has Delete account. It removes the journal immediately and cannot be undone. Sign out of other devices by deleting the account, which ends the session.</p>
    </LegalDoc>
  );
}
