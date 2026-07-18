export default function LoginLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-[#f4f7f4] flex items-center justify-center p-0 md:p-6 overflow-x-hidden select-none">
            <div className="w-full max-w-[430px] min-h-screen md:min-h-[850px] md:h-[850px] md:rounded-[40px] md:shadow-[0_24px_70px_-15px_rgba(4,64,48,0.15)] bg-white overflow-hidden relative flex flex-col border border-emerald-500/5">
                {children}
            </div>
        </div>
    );
}
