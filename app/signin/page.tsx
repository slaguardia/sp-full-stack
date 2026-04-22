import { SigninForm } from "@/components/signin-form";

export const metadata = {
  title: "Checkpoint · FSC Supply Corps",
  description: "Operator sign-in for the classification depot.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { callbackUrl = "/", error } = await searchParams;
  return <SigninForm callbackUrl={callbackUrl} initialError={error} />;
}
