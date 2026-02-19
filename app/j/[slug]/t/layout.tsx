import { ReactNode } from "react";

export default async function CustomerTicketLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <>
      <link rel="stylesheet" href={`/j/${slug}/theme.css`} />
      {children}
    </>
  );
}
