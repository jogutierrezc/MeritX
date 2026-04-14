import React from 'react';
import { Fingerprint, Globe } from 'lucide-react';
import type { FormData, Produccion } from '../../../types';
import { fetchOrcidDataMock } from '../../../services/orcid';

interface RegistroOrcidProps {
  formData: FormData;
  onUpdateField: (field: keyof FormData, value: any) => void;
  onAddProduccion: (data: Produccion[]) => void;
}

export const RegistroOrcid: React.FC<RegistroOrcidProps> = ({
  formData,
  onUpdateField,
  onAddProduccion,
}) => {
  const [loading, setLoading] = React.useState(false);

  const handleConnect = async () => {
    if (!formData.orcid) return;
    
    setLoading(true);
    // Simulating ORCID API call
    setTimeout(() => {
      const mockData = fetchOrcidDataMock();
      onAddProduccion(mockData);
      setLoading(false);
    }, 1500);
  };

  return (
    <section className="bg-white p-10 border-2 border-slate-200 space-y-8">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3 text-slate-950 border-l-8 border-slate-950 pl-6">
          <Fingerprint size={20} />
          <h3 className="font-black uppercase tracking-widest text-[11px]">Sincronización ORCID</h3>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-0">
        <input
          value={formData.orcid}
          onChange={(e) => onUpdateField('orcid', e.target.value)}
          type="text"
          placeholder="0000-0000-0000-0000"
          className="flex-1 p-5 bg-slate-50 border-2 border-slate-100 focus:border-slate-950 outline-none font-mono text-xl tracking-tighter"
        />
        <button
          onClick={handleConnect}
          disabled={loading || !formData.orcid}
          className="bg-slate-950 text-white px-10 font-black text-[10px] tracking-[0.2em] hover:bg-blue-600 transition-all active:scale-95 disabled:opacity-50"
        >
          {loading ? 'CONECTANDO...' : 'CONECTAR'}
        </button>
      </div>

      <div className="space-y-px bg-slate-200 border border-slate-200">
        {formData.produccion.map((art, i) => (
          <div key={i} className="p-6 bg-white flex justify-between items-center group">
            <div className="flex-1">
              <h4 className="text-[11px] font-black text-slate-900 leading-tight uppercase mb-2 tracking-tight">
                {art.titulo}
              </h4>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Globe size={10} /> {art.source} • {art.fecha}
              </p>
            </div>
            <div className="bg-slate-100 text-slate-950 px-4 py-2 text-[10px] font-black border border-slate-200">
              {art.cuartil}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
