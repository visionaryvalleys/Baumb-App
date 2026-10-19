import { redirect } from "next/navigation";

export default function ReviewPage() {
  redirect("/calendar?line=1");
}
