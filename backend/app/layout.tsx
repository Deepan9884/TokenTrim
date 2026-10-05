export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', background: '#0a0f1d', color: '#f1f5f9' }}>
        {children}
      </body>
    </html>
  );
}
