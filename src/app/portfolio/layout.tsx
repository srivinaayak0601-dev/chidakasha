import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Antigravity Propulsion Synthesis | Aerospace Design Syndicate',
  description: 'Speculative Propulsion CAD and Advanced Fusion 360 Workflows for Tier-1 engineering.',
  keywords: ['Speculative Propulsion CAD', 'Advanced Fusion 360 Workflows', 'Antigravity', 'Aerospace'],
};

export default function PortfolioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
