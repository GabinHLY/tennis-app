import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const ADMIN_PASSWORD = "tennisadmin"; // à changer si besoin

// Tennis ball SVG as data URL
const tennisBallIcon = new L.Icon({
  iconUrl:
    "data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='20' cy='20' r='18' fill='%23FDE047' stroke='%23FACC15' stroke-width='4'/%3E%3Cpath d='M10 10 Q20 20 30 10' stroke='%23A3E635' stroke-width='2' fill='none'/%3E%3Cpath d='M10 30 Q20 20 30 30' stroke='%23A3E635' stroke-width='2' fill='none'/%3E%3C/svg%3E",
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40],
  className: "tennis-marker"
});

// Fix default marker icon for leaflet in Vite
if (typeof window !== "undefined" && L && L.Icon && L.Icon.Default) {
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

function App() {
  const [complexes, setComplexes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [nom, setNom] = useState("");
  const [adresse, setAdresse] = useState("");
  const [surface, setSurface] = useState("");
  const [nombre, setNombre] = useState(1);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [route, setRoute] = useState(window.location.pathname);
  const [admin, setAdmin] = useState(false);
  const [adminPw, setAdminPw] = useState("");
  const [adminError, setAdminError] = useState("");
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [geocodeError, setGeocodeError] = useState("");

  useEffect(() => {
    const onPopState = () => setRoute(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    fetchComplexes();
  }, [route, admin]);

  const fetchComplexes = async () => {
    setLoading(true);
    const url = admin ? `${API_URL}/admin/complexes` : `${API_URL}/complexes`;
    const res = await fetch(url);
    const data = await res.json();
    setComplexes(data);
    setLoading(false);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("nom", nom);
    formData.append("adresse", adresse);
    formData.append("surface", surface);
    formData.append("nombre_terrains", nombre);
    formData.append("lat", lat);
    formData.append("lng", lng);
    if (photo) formData.append("photo", photo);
    await fetch(`${API_URL}/complexes`, {
      method: "POST",
      body: formData,
    });
    setNom(""); setAdresse(""); setSurface(""); setNombre(1); setLat(""); setLng(""); setPhoto(null); setShowForm(false);
    fetchComplexes();
  };

  const handleOccupation = async (terrainId) => {
    await fetch(`${API_URL}/terrains/${terrainId}/occupation`, { method: "POST" });
    fetchComplexes();
  };

  // Navigation
  const goTo = (path) => {
    window.history.pushState({}, "", path);
    setRoute(path);
  };

  // Auth admin (à garder pour la suite)
  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminPw === ADMIN_PASSWORD) {
      setAdmin(true);
      setAdminError("");
    } else {
      setAdminError("Mot de passe incorrect");
    }
  };

  // Géocodage adresse → lat/lng
  const handleGeocode = async () => {
    setGeocodeLoading(true);
    setGeocodeError("");
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(adresse)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        setLat(data[0].lat);
        setLng(data[0].lon);
      } else {
        setGeocodeError("Adresse non trouvée");
      }
    } catch (e) {
      setGeocodeError("Erreur lors de la recherche");
    }
    setGeocodeLoading(false);
  };

  // Affichage public
  if (route !== "/admin") {
    // Calcul du centre de la carte
    let center = [46.603354, 1.888334]; // France par défaut
    if (complexes.length > 0) {
      const lats = complexes.map(c => parseFloat(c.lat)).filter(Boolean);
      const lngs = complexes.map(c => parseFloat(c.lng)).filter(Boolean);
      if (lats.length && lngs.length) {
        center = [
          lats.reduce((a, b) => a + b, 0) / lats.length,
          lngs.reduce((a, b) => a + b, 0) / lngs.length,
        ];
      }
    }
    return (
      <div className="min-h-screen flex flex-col items-center px-4 md:px-6 pb-10" style={{background: 'var(--color-bg-light)', color: 'var(--color-text-light)'}}>
      <header className="tenko-header py-8 px-4">
      <h1 className="tenko-header-title text-center text-6xl font-extrabold mb-4">🎾 TENKO</h1>
      <p className="tenko-header-desc px-2 py-2">Trouvez et partagez les terrains de tennis gratuits autour de vous. Ajoutez un complexe, signalez l'occupation, et aidez la communauté !</p>
      </header>
      {/* Carte Leaflet */}
      <div className="w-full max-w-4xl mx-auto mb-10 px-3" style={{ height: 400 }}>
      <MapContainer center={center} zoom={6} style={{ height: 400, width: "100%", borderRadius: 24, boxShadow: "0 4px 24px #0002", border: `3px solid var(--color-accent)` }} scrollWheelZoom={true}>
      <TileLayer
        attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png"
      />
      {lat && lng && showForm && (
        <Marker position={[parseFloat(lat), parseFloat(lng)]} icon={tennisBallIcon}>
        <Popup><span className="font-bold text-lg text-center block p-2">Position du complexe</span></Popup>
        </Marker>
      )}
      {complexes.map(c => (
        <Marker key={c.id} position={[parseFloat(c.lat), parseFloat(c.lng)]} icon={tennisBallIcon}>
        <Popup>
        <div className="card-tenko text-center p-3">
        <div className="tenko-title p-1">{c.nom}</div>
        <div className="tenko-address p-1">{c.adresse}</div>
        <div className="tenko-surface p-1">Surface : <span className="font-semibold">{c.surface}</span></div>
        <div className="tenko-surface p-1">Nombre de terrains : <span className="font-semibold">{c.nombre_terrains}</span></div>
        </div>
        </Popup>
        </Marker>
      ))}
      </MapContainer>
      </div>
      <div className="flex justify-center mb-8 w-full px-4">
      <button onClick={() => setShowForm(f => !f)} className="tenko-btn-main mx-auto block w-full max-w-md py-4 px-6">
      {showForm ? "Annuler" : "+ Ajouter un complexe"}
      </button>
      </div>
      {showForm && (
      <form onSubmit={handleAdd} className="card-tenko flex flex-col gap-5 max-w-md mx-auto mb-10 items-center p-6">
      <label className="font-semibold w-full text-center py-1">Nom du complexe</label>
      <input required value={nom} onChange={e => setNom(e.target.value)} placeholder="Nom du complexe" className="p-4 border border-[var(--color-border-light)] rounded-lg bg-white text-black focus:ring-2 focus:ring-[var(--color-accent)] outline-none w-full text-center text-lg" />
      <label className="font-semibold w-full text-center py-1">Adresse</label>
      <div className="flex gap-2 items-center w-full justify-center">
        <input required value={adresse} onChange={e => setAdresse(e.target.value)} placeholder="Adresse" className="p-4 border border-[var(--color-border-light)] rounded-lg bg-white text-black flex-1 focus:ring-2 focus:ring-[var(--color-accent)] outline-none text-center text-lg" />
        <button type="button" onClick={handleGeocode} className="tenko-btn-main px-5 py-3 text-base" disabled={geocodeLoading || !adresse}>
        {geocodeLoading ? "..." : "Localiser"}
        </button>
      </div>
      {geocodeError && <div className="text-base text-center py-3 px-5" style={{background: 'var(--color-danger)', color: 'var(--color-bg-light)', borderRadius: 12}}>{geocodeError}</div>}
      <label className="font-semibold w-full text-center py-1">Surface</label>
      <input required value={surface} onChange={e => setSurface(e.target.value)} placeholder="Surface (béton, terre battue...)" className="p-4 border border-[var(--color-border-light)] rounded-lg bg-white text-black focus:ring-2 focus:ring-[var(--color-accent)] outline-none w-full text-center text-lg" />
      <label className="font-semibold w-full text-center py-1">Nombre de terrains</label>
      <input required value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre de terrains" className="p-4 border border-[var(--color-border-light)] rounded-lg bg-white text-black focus:ring-2 focus:ring-[var(--color-accent)] outline-none w-full text-center text-lg" type="number" min={1} />
      {/* Champs lat/lng cachés mais requis pour le backend */}
      <input type="hidden" value={lat} name="lat" />
      <input type="hidden" value={lng} name="lng" />
      {lat && lng && (
        <div className="text-base text-center py-3 px-5" style={{background: 'var(--color-accent)', color: 'var(--color-bg-dark)', borderRadius: 12}}>Position trouvée : {lat}, {lng}</div>
      )}
      <label className="font-semibold w-full text-center py-1">Photo (optionnel)</label>
      <input type="file" accept="image/*" onChange={e => setPhoto(e.target.files[0])} className="p-3 bg-white text-black rounded-lg w-full" />
      <button type="submit" className="tenko-btn-main w-full mt-2 py-4 px-6" disabled={!lat || !lng}>Envoyer</button>
      </form>
      )}
      {loading ? <div className="text-center text-xl py-6 px-4">Chargement...</div> : null}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12 w-full justify-items-center px-4">
      {complexes.map(c => (
      <div key={c.id} className="card-tenko flex flex-col gap-5 items-center max-w-md mx-auto text-center animate-fade-in p-6">
        <div className="tenko-title flex items-center gap-2 justify-center mb-2 px-3 py-2">
        {c.nom}
        </div>
        <div className="tenko-address mb-1 px-3 py-1">{c.adresse}</div>
        <div className="tenko-surface mb-1 px-3 py-1">Surface : <span className="font-semibold">{c.surface}</span></div>
        <div className="tenko-surface mb-1 px-3 py-1">Nombre de terrains : <span className="font-semibold">{c.nombre_terrains}</span></div>
        {c.photo && <img src={`${API_URL}/uploads/${c.photo}`} alt="complexe" className="w-full h-48 object-cover rounded-xl border shadow mb-2 mx-auto" style={{ objectPosition: 'center' }} />}
        <div className="flex flex-col gap-3 mt-2 w-full px-2">
        {c.terrains && c.terrains.map(t => (
        <div key={t.id} className="flex flex-col md:flex-row items-center justify-center gap-3 w-full p-2">
        <span className="font-semibold text-lg px-2">Terrain {t.numero}</span>
        <span className="tenko-status mx-2 px-3 py-1">{t.occupe ? "Occupé" : "Libre"}</span>
        <div className="tenko-actions px-2">
          <button onClick={() => handleOccupation(t.id)} className="tenko-btn-main flex items-center gap-2 px-5 py-3">
          <span role="img" aria-label="tennis">🎾</span> {t.occupe ? "Check-out" : "Check-in"}
          </button>
        </div>
        </div>
        ))}
        </div>
      </div>
      ))}
      </div>
      </div>
    );
  }

  // Affichage admin
  if (route === "/admin") {
    if (!admin) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-white font-sans">
          <form onSubmit={handleAdminLogin} className="bg-[#fef9c3] border-2 border-yellow-300 p-10 rounded-2xl shadow-xl flex flex-col gap-6 w-full max-w-md items-center">
            <h2 className="text-3xl font-bold mb-2 text-center text-black">Connexion Admin</h2>
            <input type="password" value={adminPw} onChange={e => setAdminPw(e.target.value)} placeholder="Mot de passe admin" className="p-4 border border-yellow-300 rounded-lg bg-white text-black focus:ring-2 focus:ring-yellow-300 outline-none w-full text-center text-lg" />
            {adminError && <div className="text-black text-base text-center py-2 px-4 bg-yellow-200 rounded-lg w-full">{adminError}</div>}
            <button type="submit" className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold px-8 py-4 rounded-full shadow-lg text-xl transition-all w-full animate-pulse hover:animate-none">Se connecter</button>
            <button type="button" onClick={() => goTo("/")} className="text-black text-base mt-2">Retour</button>
          </form>
        </div>
      );
    }
    // Dashboard admin
    return (
      <div className="min-h-screen bg-white font-sans px-2 md:px-0 pb-8 flex flex-col items-center">
        <div className="flex flex-col items-center mb-8 w-full">
          <h1 className="text-5xl font-extrabold mt-10 mb-4 text-center text-black drop-shadow">🎾 Admin - Complexes</h1>
          <p className="text-black text-xl mb-8 text-center max-w-2xl">Validez, modifiez ou supprimez les complexes proposés par la communauté.</p>
          <button onClick={() => { setAdmin(false); setAdminPw(""); goTo("/"); }} className="px-8 py-4 rounded-full bg-yellow-400 hover:bg-yellow-300 text-black font-bold shadow-lg text-xl mt-2 w-full max-w-md animate-pulse hover:animate-none">Déconnexion</button>
        </div>
        {loading ? <div className="text-center text-black text-xl py-4">Chargement...</div> : null}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12 w-full justify-items-center">
          {complexes.map(c => (
            <div key={c.id} className="bg-[#fef9c3] rounded-2xl shadow-xl p-8 flex flex-col gap-5 border-2 border-yellow-300 hover:shadow-2xl transition-all items-center max-w-md mx-auto text-center animate-fade-in">
              <div className="font-bold text-3xl text-black flex items-center gap-2 justify-center mb-2">
                {c.nom}
                {!c.valide && <span className="ml-2 text-base bg-yellow-400 text-black px-4 py-1 rounded-full font-semibold border border-yellow-300">Non validé</span>}
              </div>
              <div className="text-lg text-black mb-1">{c.adresse}</div>
              <div className="text-lg text-black mb-1">Surface : <span className="font-semibold">{c.surface}</span></div>
              <div className="text-lg text-black mb-1">Nombre de terrains : <span className="font-semibold">{c.nombre_terrains}</span></div>
              {c.photo && <img src={`${API_URL}/uploads/${c.photo}`} alt="complexe" className="w-full h-48 object-cover rounded-xl border shadow mb-2 mx-auto" style={{ objectPosition: 'center' }} />}
              <div className="flex flex-col gap-4 mt-2 w-full">
                <div className="flex flex-row gap-4 justify-center w-full">
                  {!c.valide && <button onClick={async () => { await fetch(`${API_URL}/admin/complexes/${c.id}/valider`, { method: "PATCH" }); fetchComplexes(); }} className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold px-8 py-3 rounded-full shadow-lg text-lg transition-all animate-pulse hover:animate-none">Valider</button>}
                  <button onClick={async () => { if(window.confirm("Supprimer ce complexe ?")) { await fetch(`${API_URL}/admin/complexes/${c.id}`, { method: "DELETE" }); fetchComplexes(); } }} className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold px-8 py-3 rounded-full shadow-lg text-lg transition-all animate-pulse hover:animate-none">Supprimer</button>
                </div>
                <div className="flex flex-col gap-3 mt-2 w-full">
                  {c.terrains && c.terrains.map(t => (
                    <div key={t.id} className="flex flex-col md:flex-row items-center justify-center gap-3 w-full">
                      <span className="font-semibold text-black text-lg">Terrain {t.numero}</span>
                      <span className="font-semibold text-black text-base bg-yellow-200 rounded-full px-4 py-1 mx-2">{t.occupe ? "Occupé" : "Libre"}</span>
                      <button onClick={async () => { await fetch(`${API_URL}/terrains/${t.id}/occupation`, { method: "POST" }); fetchComplexes(); }} className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold px-6 py-2 rounded-full shadow-lg text-lg flex items-center gap-2 transition-all animate-pulse hover:animate-none"><span role="img" aria-label="tennis">🎾</span> {t.occupe ? "Check-out" : "Check-in"}</button>
                      <button onClick={async () => { if(window.confirm("Supprimer ce terrain ?")) { await fetch(`${API_URL}/admin/terrains/${t.id}`, { method: "DELETE" }); fetchComplexes(); } }} className="bg-yellow-200 hover:bg-yellow-300 text-black px-6 py-2 rounded-full shadow-lg text-lg transition-all">Supprimer</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
}

export default App;
