export default function LoginLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-background isolate">
            {/* We skip Header and BottomNav here for a full-screen immersive feel */}
            <main className="min-h-screen flex items-center justify-center relative overflow-hidden">
                {/* Animated background blobs for premium feel */}
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-green-400/20 rounded-full blur-[120px] animate-pulse delay-700" />

                <div className="z-10 w-full">
                    {children}
                </div>
            </main>
        </div>
    );
}
