import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from '../hook/useAuth'
import { getWallet } from '../services/walletService'

interface WalletContextType {
    wallet: { balance: number } | null
    loading: boolean
    refreshWallet: () => Promise<void>
}

const WalletContext = createContext<WalletContextType | null>(null)

export const WalletProvider = ({ children }: { children: React.ReactNode }) => {
    const { user } = useAuth()
    const [wallet, setWallet] = useState<{ balance: number } | null>(null)
    const [loading, setLoading] = useState(false)

    const refreshWallet = async () => {
        if (!user) return
        setLoading(true)
        try {
            const response = await getWallet()
            setWallet(response.data.data)
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (user) {
            refreshWallet()
        } else {
            setWallet(null)
        }
    }, [user])

    return (
        <WalletContext.Provider value={{ wallet, loading, refreshWallet }}>
            {children}
        </WalletContext.Provider>
    )
}

export const useWallet = () => {
    const context = useContext(WalletContext)
    if (!context) throw new Error('useWallet must be used within WalletProvider')
    return context
}
