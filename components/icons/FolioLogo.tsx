import Image from "next/image"

export function FolioLogo({ className = "w-32 h-8" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-[1.5px]  ${className}`}>
      <Image
        src="/site-logo.png"
        alt="Unrealshot AI Logo"
        width={24}
        height={24}
        className="w-8 h-8 rounded"
      />
      <span className="text-xl font-bold text-gray-700 font-mono ml-1">
        Unrealshot
      </span>
    </div>
  )
}