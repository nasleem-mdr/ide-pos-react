import '../css/Components.css';
import '../css/Header.css';
import { COLOR, RADIUS } from '../utils/styleTokens';
import { HomeIcon } from "../components/Icons";
import { useNavigate } from "react-router-dom";
export default function PageHeader({ title, onSearch }) {
  const navigate                        = useNavigate();
  return (
    
    <div className="page-header-container">
      <div className="page-header-left">
        <button
            onClick={() => navigate('/dashboard')}
              style={{
              background: 'rgba(255,255,255,0.15)', border: 'none', color: 'rgb(99 102 241)',
              borderRadius: RADIUS.sm, padding: '6px 10px', cursor: 'pointer',
              fontSize: '13px', fontWeight: 600, WebkitTapHighlightColor: 'transparent',
            }}
        ><HomeIcon size={24} className='home-color'/>
        </button>
     
        <h2 className="page-header-title">{title}</h2>
      </div>
      <input 
        type="text" 
        placeholder={`Cari ${title}...`} 
        onChange={(e) => onSearch(e.target.value)}
        className="page-header-search"
      />
    </div>
  );
}
