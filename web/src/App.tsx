import { useEffect, useState } from 'react'
import axios from 'axios'
import { Activity, Play, Square, Database, RefreshCw, Download, FileSpreadsheet, Search, Trash2, CheckSquare } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const API_URL = import.meta.env.VITE_API_URL || '/api'

interface Profile {
    id: number
    name: string
    phone: string
    country: string
    city: string
    languages: string
    age: string
    scraped_at: string
}

interface FileInfo {
    name: string
    size: string
    modified: string
}

function App() {
    const [running, setRunning] = useState(false)
    const [iframeLoading, setIframeLoading] = useState(true)
    const [stats, setStats] = useState({ total: 0 })
    const [profiles, setProfiles] = useState<Profile[]>([])
    const [files, setFiles] = useState<FileInfo[]>([])
    const [logs, setLogs] = useState<string[]>([])
    const [loading, setLoading] = useState(false)
    const [targetUrl, setTargetUrl] = useState('https://www.eurogirlsescort.com/escorts/milan/')
    const [activeTab, setActiveTab] = useState<'live' | 'files'>('live')
    const [searchTerm, setSearchTerm] = useState('')

    // SELEÇÃO
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

    // FILTRO: SÓ TELEFONES COMPLETOS
    const [onlyComplete, setOnlyComplete] = useState(false)

    // Filtra telefones completos (10+ dígitos)
    const isPhoneComplete = (phone: string) => {
        const digits = phone.replace(/\D/g, '')
        return digits.length >= 10
    }

    const filteredProfiles = onlyComplete
        ? profiles.filter(p => isPhoneComplete(p.phone))
        : profiles

    useEffect(() => {
        const interval = setInterval(fetchAll, 3000)
        fetchProfiles()
        fetchFiles()
        return () => clearInterval(interval)
    }, [])

    useEffect(() => {
        const timer = setTimeout(() => fetchProfiles(), 500)
        return () => clearTimeout(timer)
    }, [searchTerm])

    const fetchAll = async () => {
        try {
            const s = await axios.get(`${API_URL}/status`)
            setRunning(s.data.running)
            const d = await axios.get(`${API_URL}/stats`)
            setStats(d.data)

            // Atualiza dados da tabela também se for a aba ativa
            if (activeTab === 'live') {
                await fetchProfiles()
            }
        } catch (e) { console.error(e) }
    }

    const fetchProfiles = async () => {
        if (document.hidden) return // Não atualiza se aba estiver oculta
        try {
            const url = searchTerm ? `${API_URL}/profiles?search=${encodeURIComponent(searchTerm)}` : `${API_URL}/profiles`
            const p = await axios.get(url)

            // Só atualiza se mudou o tamanho ou para garantir dados frescos
            // Na verdade, sempre atualiza para pegar novos campos
            setProfiles(p.data)

            // NÃO reseta seleção a cada update, senão incomoda o usuário deletando
            // setSelectedIds(new Set()) 
        } catch (e) { console.error(e) }
    }

    const fetchFiles = async () => {
        try {
            const f = await axios.get(`${API_URL}/files`)
            setFiles(f.data)
        } catch (e) { console.error(e) }
    }

    const handleStart = async () => {
        if (!targetUrl.trim()) { addLog("ERRO: URL vazia!"); return }
        setLoading(true)
        try {
            await axios.post(`${API_URL}/start`, { url: targetUrl })
            setRunning(true)
            addLog(`>>> Iniciando: ${targetUrl}`)
        } catch (e) { addLog("Erro ao iniciar.") }
        setLoading(false)
    }

    const handleStop = async () => {
        setLoading(true)
        try {
            await axios.post(`${API_URL}/stop`)
            setRunning(false)
            addLog(">>> PARAR enviado.")
            fetchFiles()
        } catch (e) { addLog("Erro ao parar.") }
        setLoading(false)
    }

    // SELEÇÃO
    const toggleSelect = (id: number) => {
        const newSet = new Set(selectedIds)
        if (newSet.has(id)) {
            newSet.delete(id)
        } else {
            newSet.add(id)
        }
        setSelectedIds(newSet)
    }

    const selectAll = () => {
        if (selectedIds.size === filteredProfiles.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(filteredProfiles.map(p => p.id)))
        }
    }

    // AÇÕES EM LOTE
    const deleteSelected = async () => {
        if (selectedIds.size === 0) return
        if (!confirm(`Excluir ${selectedIds.size} registros selecionados?`)) return

        try {
            await axios.post(`${API_URL}/profiles/delete`, { ids: Array.from(selectedIds) })
            addLog(`>>> ${selectedIds.size} registros excluídos!`)
            fetchProfiles()
            fetchAll()
        } catch (e) { addLog("Erro ao excluir.") }
    }

    const downloadSelected = () => {
        if (selectedIds.size === 0) return

        const selected = profiles.filter(p => selectedIds.has(p.id))
        let csv = '\uFEFF' + "Nome;Telefone;Pais;Cidade;Idiomas;Idade\n"
        selected.forEach(r => {
            csv += `"${r.name}";"${r.phone}";"${r.country || ''}";"${r.city || ''}";"${r.languages || ''}";"${r.age || ''}"\n`
        })

        const blob = new Blob([csv], { type: 'application/vnd.ms-excel;charset=utf-8' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `selecionados_${selectedIds.size}.xlsx`
        a.click()
        addLog(`>>> Download de ${selectedIds.size} registros...`)
    }

    const exportCSV = () => { window.open(`${API_URL}/export/csv`, '_blank'); addLog(">>> Export CSV...") }

    const exportExcel = async () => {
        try {
            const res = await axios.get(`${API_URL}/export/json`)
            let csv = '\uFEFF' + "Nome;Telefone;Pais;Cidade;Idiomas;Idade;Data\n"
            res.data.forEach((r: Profile) => {
                csv += `"${r.name}";"${r.phone}";"${r.country || ''}";"${r.city || ''}";"${r.languages || ''}";"${r.age || ''}";"${new Date(r.scraped_at).toLocaleString('pt-BR')}"\n`
            })
            const blob = new Blob([csv], { type: 'application/vnd.ms-excel;charset=utf-8' })
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'contatos.xlsx'; a.click()
            addLog(">>> Export Excel...")
        } catch (e) { addLog("Erro export.") }
    }

    const downloadFile = (filename: string) => window.open(`${API_URL}/files/${filename}`, '_blank')

    const deleteFile = async (filename: string) => {
        if (confirm(`Excluir ${filename}?`)) {
            try {
                await axios.delete(`${API_URL}/files/${filename}`)
                addLog(`>>> ${filename} excluído!`)
                fetchFiles()
            } catch (e) { addLog("Erro ao excluir.") }
        }
    }

    const addLog = (msg: string) => setLogs(prev => [msg, ...prev].slice(0, 15))

    const [currentView, setCurrentView] = useState<'monitor' | 'automation'>('monitor')

    // ANIMATION VARIANTS
    const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } }
    const itemVariants = { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } }

    return (
        <div className="min-h-screen bg-background text-primary p-4 font-mono">
            {/* HEADER */}
            <header className="flex justify-between items-center mb-6 border-b border-primary/20 pb-3">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-black border border-primary text-primary rounded shadow-[0_0_10px_#00ff41]"><Activity size={24} /></div>
                        <div>
                            <h1 className="text-3xl font-bold text-primary tracking-wider" style={{ textShadow: '0 0 10px rgba(0,255,65,0.5)' }}>LINKIVERSE MATRIX</h1>
                            <p className="text-primary/70 text-xs">CONTROLE DO SISTEMA</p>
                        </div>
                    </div>

                    {/* VIEW SWITCHER */}
                    <div className="flex bg-black/40 p-1 rounded border border-primary/30">
                        <button
                            onClick={() => setCurrentView('monitor')}
                            className={`px-6 py-2 rounded text-sm font-bold transition-all ${currentView === 'monitor' ? 'bg-primary text-black shadow-[0_0_15px_#00ff41]' : 'text-primary/50 hover:text-primary'}`}
                        >
                            <div className="flex items-center gap-2"><Database size={16} /> BASE DE DADOS</div>
                        </button>
                        <button
                            onClick={() => setCurrentView('automation')}
                            className={`px-6 py-2 rounded text-sm font-bold transition-all ${currentView === 'automation' ? 'bg-primary text-black shadow-[0_0_15px_#00ff41]' : 'text-primary/50 hover:text-primary'}`}
                        >
                            <div className="flex items-center gap-2"><Play size={16} /> ROBÔ DE VENDAS</div>
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button onClick={exportCSV} className="px-3 py-1.5 border border-primary text-primary hover:bg-primary hover:text-black rounded text-xs font-bold transition-all flex items-center gap-2 uppercase tracking-wide">
                        <FileSpreadsheet size={14} /> EXPORTAR CSV
                    </button>
                    <button onClick={exportExcel} className="px-3 py-1.5 border border-primary text-primary hover:bg-primary hover:text-black rounded text-xs font-bold transition-all flex items-center gap-2 uppercase tracking-wide">
                        <Download size={14} /> EXPORTAR XLS
                    </button>
                    <div className={`px-3 py-1.5 rounded border text-xs font-bold flex items-center gap-2 uppercase tracking-wide ${running ? 'border-primary text-primary bg-primary/10' : 'border-red-500 text-red-500 bg-red-900/20'}`}>
                        <div className={`w-2 h-2 rounded-full ${running ? 'bg-primary shadow-[0_0_10px_#00ff41] animate-pulse' : 'bg-red-500'}`}></div>
                        {running ? "SISTEMA ONLINE" : "SISTEMA OFFLINE"}
                    </div>
                </div>
            </header>

            {/* MAIN CONTENT AREA */}
            <AnimatePresence mode="wait">
                {currentView === 'automation' ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="w-full h-[85vh] rounded-xl overflow-hidden border border-primary/50 bg-black flex flex-col shadow-[0_0_20px_rgba(0,255,65,0.1)]"
                    >
                        <div className="bg-black p-2 text-xs flex justify-between items-center border-b border-primary/30">
                            <span className="text-primary/70 animate-pulse">⚡ CONECTADO: 127.0.0.1:8501</span>
                            <a href="http://localhost:8501" target="_blank" rel="noreferrer" className="text-primary hover:underline hover:text-white uppercase">
                                [ABRIR JANELA EXTERNA] ↗
                            </a>
                        </div>
                        <div className="relative flex-1 w-full h-full bg-black/90">
                            {iframeLoading && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black text-primary">
                                    <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin shadow-[0_0_20px_rgba(0,255,65,0.4)] mb-4"></div>
                                    <span className="animate-pulse text-xs tracking-widest uppercase">Carregando Matrix...</span>
                                </div>
                            )}
                            <iframe
                                src="http://127.0.0.1:8501/?embed=true"
                                className={`w-full h-full transition-opacity duration-500 ${iframeLoading ? 'opacity-0' : 'opacity-100'}`}
                                title="Automation Dashboard"
                                allow="microphone *; camera *; clipboard-read *; clipboard-write *"
                                onLoad={() => setIframeLoading(false)}
                            />
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className="flex flex-col gap-4"
                    >
                        {/* CONTROLES */}
                        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-black p-4 rounded border border-primary/30 shadow-[0_0_10px_rgba(0,255,65,0.05)]">
                                <div className="text-primary/60 text-xs mb-1 uppercase tracking-widest">Registros no Banco</div>
                                <div className="text-3xl font-bold text-primary" style={{ textShadow: '0 0 10px #00ff41' }}>{stats.total}</div>
                            </div>
                            <div className="bg-black p-4 rounded border border-primary/30 shadow-[0_0_10px_rgba(0,255,65,0.05)]">
                                <div className="text-primary/60 text-xs mb-1 uppercase tracking-widest">Arquivos Gerados</div>
                                <div className="text-3xl font-bold text-primary" style={{ textShadow: '0 0 10px #00ff41' }}>{files.length}</div>
                            </div>
                            <div className="bg-black p-4 rounded border border-primary/30 col-span-2 shadow-[0_0_10px_rgba(0,255,65,0.05)]">
                                <label className="text-xs text-primary/60 mb-2 block uppercase tracking-widest">URL Alvo (Captura Legada)</label>
                                <div className="flex gap-3">
                                    <input type="text" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} disabled={running}
                                        className="flex-1 bg-black border border-primary/50 rounded px-3 py-2 text-sm text-primary focus:border-primary focus:shadow-[0_0_10px_#00ff41] focus:outline-none placeholder-primary/30 font-mono" />
                                    {!running ? (
                                        <button onClick={handleStart} disabled={loading} className="px-6 bg-primary hover:bg-white hover:text-black text-black font-bold rounded flex items-center gap-2 text-sm uppercase tracking-wide transition-all shadow-[0_0_10px_rgba(0,255,65,0.4)]">
                                            <Play size={16} fill="currentColor" /> INICIAR
                                        </button>
                                    ) : (
                                        <button onClick={handleStop} disabled={loading} className="px-6 bg-red-600 hover:bg-red-500 text-white font-bold rounded flex items-center gap-2 text-sm uppercase tracking-wide transition-all shadow-[0_0_10px_rgba(220,38,38,0.4)]">
                                            <Square size={16} fill="currentColor" /> PARAR
                                        </button>
                                    )}
                                </div>
                            </div>
                        </motion.div>

                        {/* TABS + BUSCA */}
                        <motion.div variants={itemVariants} className="flex justify-between items-center bg-black/40 p-2 rounded border border-primary/20">
                            <div className="flex gap-2">
                                <button onClick={() => setActiveTab('live')} className={`px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'live' ? 'bg-primary text-black' : 'text-primary/50 hover:text-primary'}`}>
                                    DADOS EM TEMPO REAL ({filteredProfiles.length})
                                </button>
                                <button onClick={() => { setActiveTab('files'); fetchFiles(); }} className={`px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'files' ? 'bg-primary text-black' : 'text-primary/50 hover:text-primary'}`}>
                                    ARQUIVOS ({files.length})
                                </button>
                                {activeTab === 'live' && (
                                    <button
                                        onClick={() => setOnlyComplete(!onlyComplete)}
                                        className={`px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition-all border border-primary/30 ${onlyComplete ? 'bg-primary/20 text-primary shadow-[0_0_10px_#00ff41]' : 'text-primary/50 hover:text-primary'}`}
                                    >
                                        FILTRAR VÁLIDOS {onlyComplete && `(${filteredProfiles.length})`}
                                    </button>
                                )}
                            </div>

                            {activeTab === 'live' && (
                                <div className="flex gap-3 items-center">
                                    {selectedIds.size > 0 && (
                                        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex gap-2 items-center bg-primary/10 px-3 py-1 rounded border border-primary/50">
                                            <span className="text-xs text-primary font-bold">{selectedIds.size} SELECIONADOS</span>
                                            <button onClick={downloadSelected} className="p-1 hover:text-white text-primary"><Download size={14} /></button>
                                            <button onClick={deleteSelected} className="p-1 hover:text-red-500 text-red-400"><Trash2 size={14} /></button>
                                        </motion.div>
                                    )}
                                    <div className="relative w-72">
                                        <Search size={14} className="absolute left-3 top-3 text-primary/50" />
                                        <input
                                            type="text"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            placeholder="BUSCAR NO BANCO..."
                                            className="w-full bg-black border border-primary/30 rounded pl-9 pr-3 py-2 text-sm text-primary focus:border-primary focus:shadow-[0_0_5px_#00ff41] focus:outline-none placeholder-primary/30 font-mono uppercase"
                                        />
                                    </div>
                                </div>
                            )}
                        </motion.div>

                        {/* CONTENT GRID */}
                        <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-full">
                            {/* TABLE */}
                            <div className="col-span-3 bg-black rounded border border-primary/30 overflow-hidden shadow-[0_0_15px_rgba(0,255,65,0.05)] flex flex-col h-[550px]">
                                {activeTab === 'live' ? (
                                    <>
                                        <div className="p-3 border-b border-primary/20 flex justify-between items-center bg-primary/5">
                                            <div className="flex items-center gap-3">
                                                <button onClick={selectAll} className="p-1 hover:bg-primary/20 rounded text-primary transition-colors">
                                                    <CheckSquare size={16} className={selectedIds.size === filteredProfiles.length && filteredProfiles.length > 0 ? "fill-primary/20" : ""} />
                                                </button>
                                                <h3 className="font-bold text-sm text-primary tracking-widest uppercase">REGISTROS EM TEMPO REAL</h3>
                                            </div>
                                            <button onClick={fetchProfiles} className="hover:animate-spin text-primary"><RefreshCw size={14} /></button>
                                        </div>
                                        <div className="overflow-y-auto flex-1 custom-scrollbar p-1">
                                            <table className="w-full text-left text-xs text-primary/80 font-mono">
                                                <thead className="bg-black sticky top-0 uppercase tracking-wider text-[10px] text-primary/50 border-b border-primary/20">
                                                    <tr>
                                                        <th className="p-3 w-10">#</th>
                                                        <th className="p-3">NOME</th>
                                                        <th className="p-3">TELEFONE</th>
                                                        <th className="p-3">PAÍS</th>
                                                        <th className="p-3">CIDADE</th>
                                                        <th className="p-3">IDIOMAS</th>
                                                        <th className="p-3">IDADE</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-primary/10">
                                                    {filteredProfiles.map((p, i) => (
                                                        <motion.tr
                                                            key={p.id}
                                                            initial={{ opacity: 0, x: -10 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            transition={{ delay: i * 0.05 }}
                                                            className={`hover:bg-primary/10 transition-colors ${selectedIds.has(p.id) ? 'bg-primary/20' : ''}`}
                                                        >
                                                            <td className="p-3">
                                                                <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} className="accent-primary cursor-pointer" />
                                                            </td>
                                                            <td className="p-3 font-bold text-white">{p.name}</td>
                                                            <td className="p-3 text-primary font-bold tracking-wider">{p.phone}</td>
                                                            <td className="p-3">{p.country || '--'}</td>
                                                            <td className="p-3">{p.city || '--'}</td>
                                                            <td className="p-3 truncate max-w-[150px]">{p.languages || '--'}</td>
                                                            <td className="p-3">{p.age || '--'}</td>
                                                        </motion.tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            {profiles.length === 0 && (
                                                <div className="text-center py-20 text-primary/30 uppercase tracking-widest animate-pulse">
                                                    [NENHUM DADO ENCONTRADO]
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className="p-4 space-y-2 max-h-[550px] overflow-y-auto custom-scrollbar">
                                        <div className="p-3 border-b border-primary/20 bg-primary/5 text-primary text-xs font-bold uppercase tracking-widest mb-2">
                                            ARQUIVOS ARQUIVADOS
                                        </div>
                                        {files.map((f, i) => (
                                            <motion.div
                                                key={i}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: i * 0.05 }}
                                                className="flex justify-between items-center bg-black/50 p-3 rounded border border-primary/10 hover:border-primary/50 transition-all group"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-primary/10 rounded text-primary"><FileSpreadsheet size={18} /></div>
                                                    <div>
                                                        <div className="font-bold text-sm text-white group-hover:text-primary transition-colors">{f.name}</div>
                                                        <div className="text-[10px] text-primary/50">{f.size} • {new Date(f.modified).toLocaleString()}</div>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => downloadFile(f.name)} className="p-2 hover:bg-primary hover:text-black rounded text-primary border border-primary/30 transition-all" title="BAIXAR">
                                                        <Download size={14} />
                                                    </button>
                                                    <button onClick={() => deleteFile(f.name)} className="p-2 hover:bg-red-600 hover:text-white rounded text-red-500 border border-red-500/30 transition-all" title="EXCLUIR">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </motion.div>
                                        ))}
                                        {files.length === 0 && (
                                            <div className="text-center py-20 text-primary/30 uppercase tracking-widest">
                                                [NENHUM ARQUIVO ARQUIVADO]
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* LOGS (TERMINAL) */}
                            <div className="bg-black rounded border border-primary/30 flex flex-col shadow-[0_0_15px_rgba(0,255,65,0.05)] h-[550px]">
                                <div className="p-2 border-b border-primary/20 bg-primary/5 text-primary text-xs font-bold uppercase tracking-widest">
                                    LOGS DO SISTEMA
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-2 custom-scrollbar bg-black/50">
                                    {logs.map((log, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className="text-primary/70 border-l-2 border-primary/30 pl-2"
                                        >
                                            <span className="opacity-50 text-[10px] mr-2">[{new Date().toLocaleTimeString()}]</span>
                                            {log}
                                        </motion.div>
                                    ))}
                                    {logs.length === 0 && <div className="text-primary/30 italic">Sistema pronto...</div>}
                                </div>
                            </div>

                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export default App
