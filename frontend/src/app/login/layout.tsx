import React from 'react';
import Image from 'next/image';

export default function LoginLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-white flex flex-col items-center py-10 px-4 sm:px-6 lg:px-8" dir="rtl">

            <div className="w-full max-w-md flex flex-col items-center mb-6">
                <div className="relative w-[104px] h-[74px] mb-3">
                    <Image
                        src="/logo.png"
                        alt="نور الهدى"
                        fill
                        className="object-contain"
                        priority
                    />
                </div>
                <p className="text-base text-[#6a7282] text-center leading-6">
                    لتحفيظ القرآن الكريم وعلومه
                </p>
            </div>

            <div
                className="w-full max-w-[360px] bg-white rounded-[24px] border border-[#f3f4f6] shadow-[0px_8px_10px_-6px_rgba(0,0,0,0.1)] overflow-hidden"
            >
                <div
                    className="h-2 w-full"
                    style={{
                        backgroundImage:
                            "linear-gradient(90deg, #0a528e 0%, #245a8d 7.1%, #36628b 14.3%, #46698a 21.4%, #557187 28.6%, #637885 35.7%, #727f82 42.9%, #80857f 50%, #8f8c7b 57.1%, #9d9276 64.3%, #ac9971 71.4%, #ba9f6b 78.6%, #c9a563 85.7%, #d7ab5b 92.9%, #e6b150 100%)",
                    }}
                />

                <div className="px-8 py-10">
                    {children}
                </div>
            </div>

        </div>
    );
}
