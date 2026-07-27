export const metadata = {
    title: 'CIDS License API',
    description: 'CIDS Suites Pro License Management API',
};

export default function RootLayout({ children }) {
    return (
        <html lang="ms">
            <body>{children}</body>
        </html>
    );
}
