// app/page.tsx
'use client';


import { useRouter } from 'next/navigation';

export default function Chat() {
    const router = useRouter();
    router.replace('/home')
}