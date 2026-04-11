import React from 'react';
import Image from 'next/image';

export default function LoginLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8" dir="rtl">

            <div className="w-full max-w-md flex flex-col items-center mb-8">
                {/* 
                    Using standard Image tag here. 
                    The user should ensure the generated/uploaded logo is available at /logo.png 
                */}
                <div className="relative w-48 h-48 mb-2">
                    <Image
                        src="/logo.png"
                        alt="نور الهدى"
                        fill
                        className="object-contain"
                        priority
                    />
                </div>
            </div>

            <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden">
                {/* Top gradient bar */}
                <div className="h-3 w-full bg-gradient-to-l from-secondary to-primary to-80%" />

                <div className="px-6 py-8 sm:px-10 sm:py-10">
                    {children}
                </div>
            </div>

        </div>
    );
}
