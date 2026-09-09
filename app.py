"""Streamlit app: Captura (capture -> extract -> confirm -> dedupe -> save) + Panel (browse) tabs."""
import tempfile

import pandas as pd
import streamlit as st

import confidence
import db
import dedupe
import extract
import qvac_client

STATUS_ES = {
    "confirmed": "Confirmado",
    "reported": "Reportado",
    "estimated": "Estimado",
    "unknown": "Desconocido",
}

st.set_page_config(page_title="Inteligencia de Base Instalada", layout="wide")


@st.cache_resource
def get_conn():
    return db.init_db()


conn = get_conn()

st.title("🏥 Inteligencia de Base Instalada de Clientes")
st.caption("Reto Philips · Decentralized AI Hackathon · Extracción 100% on-device con QVAC")

tab_captura, tab_panel = st.tabs(["📝 Captura", "📊 Panel"])

with tab_captura:
    st.subheader("Nueva observación")
    modo = st.radio("Modo de captura", ["Texto", "Voz"], horizontal=True)

    texto = ""
    if modo == "Texto":
        texto = st.text_area(
            "Describe lo que observaste",
            placeholder=(
                "Estoy en Hospital DemoCare Pacific, en Panamá. Tienen dos "
                "resonadores y un tomógrafo. Uno de los resonadores parece "
                "de unos ocho años."
            ),
        )
    else:
        audio = st.audio_input("Graba tu observación")
        if audio is not None and st.button("Transcribir"):
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                f.write(audio.getvalue())
                audio_path = f.name
            with st.spinner("Transcribiendo con QVAC (Whisper on-device)..."):
                try:
                    st.session_state["texto_transcrito"] = qvac_client.transcribe_sync(audio_path)
                except RuntimeError as e:
                    st.error(f"Error de QVAC: {e}")

        if st.session_state.get("texto_transcrito"):
            texto = st.text_area("Transcripción (editable)", value=st.session_state["texto_transcrito"], key="texto_editable")

    if st.button("Extraer información", disabled=not texto):
        with st.spinner("Analizando con QVAC (on-device)..."):
            try:
                st.session_state["campos_extraidos"] = extract.extract(texto)
                st.session_state["texto_fuente"] = texto
            except RuntimeError as e:
                st.error(f"Error de QVAC: {e}")

    campos = st.session_state.get("campos_extraidos")
    if campos:
        st.subheader("Confirma o completa los datos")
        st.caption("Los campos vacíos son lo que QVAC no pudo inferir del texto — complétalos si los conoces.")
        modalidades = db.get_taxonomy(conn, "modality")
        marcas = db.get_taxonomy(conn, "brand")

        with st.form("form_observacion"):
            customer = st.text_input("Hospital / Cliente", value=campos.get("customer") or "")

            col1, col2 = st.columns(2)
            city = col1.text_input("Ciudad", value=campos.get("city") or "")
            country = col2.text_input("País", value=campos.get("country") or "")

            modality = st.selectbox(
                "Modalidad del equipo", [""] + modalidades,
                index=(modalidades.index(campos["modality"]) + 1) if campos.get("modality") in modalidades else 0,
            )

            col3, col4 = st.columns(2)
            brand = col3.selectbox(
                "Marca", [""] + marcas,
                index=(marcas.index(campos["brand"]) + 1) if campos.get("brand") in marcas else 0,
            )
            model = col4.text_input("Modelo", value=campos.get("model") or "")

            col5, col6 = st.columns(2)
            quantity = col5.number_input("Cantidad", min_value=0, step=1, value=int(campos.get("quantity") or 1))
            age_years = col6.number_input("Antigüedad (años)", min_value=0.0, step=0.5, value=float(campos.get("age_years") or 0.0))

            guardar = st.form_submit_button("Guardar observación")

        if guardar:
            nuevo = {
                "customer": customer or None,
                "city": city or None,
                "country": country or None,
                "modality": modality or None,
                "brand": brand or None,
                "model": model or None,
                "quantity": int(quantity) or None,
                "age_years": age_years or None,
                "source_text": st.session_state.get("texto_fuente", ""),
            }
            existentes = db.get_all_observations(conn)
            duplicado = dedupe.find_duplicate(nuevo, existentes)
            if duplicado:
                score, status = confidence.compute_confidence(nuevo, duplicado["corroboration_count"] + 1)
                db.update_corroboration(conn, duplicado["id"], score, status)
                st.warning(
                    f"Coincide con la observación #{duplicado['id']} ya registrada. "
                    f"Se sumó como corroboración → **{STATUS_ES[status]}** (confianza {score})."
                )
            else:
                score, status = confidence.compute_confidence(nuevo)
                nuevo["confidence"] = score
                nuevo["status"] = status
                new_id = db.insert_observation(conn, nuevo)
                st.success(f"Observación #{new_id} guardada → **{STATUS_ES[status]}** (confianza {score}).")

            del st.session_state["campos_extraidos"]
            st.session_state.pop("texto_transcrito", None)
            st.rerun()

with tab_panel:
    obs = db.get_all_observations(conn)
    if not obs:
        st.info("Aún no hay observaciones registradas. Ve a la pestaña Captura para agregar la primera.")
    else:
        df = pd.DataFrame(obs)
        df["status_es"] = df["status"].map(STATUS_ES).fillna(df["status"])

        st.subheader("Vista por cliente")
        clientes = sorted(df["customer"].dropna().unique())
        cliente_sel = st.selectbox("Cliente", ["Todos"] + clientes)
        vista = df if cliente_sel == "Todos" else df[df["customer"] == cliente_sel]
        st.dataframe(
            vista[["customer", "city", "country", "modality", "brand", "model",
                   "quantity", "age_years", "status_es", "confidence",
                   "corroboration_count", "created_at"]],
            use_container_width=True, hide_index=True,
        )

        st.subheader("Vista agregada entre clientes")
        pivot = (
            df.groupby(["modality", "brand"], dropna=False)
            .agg(
                cantidad_total=("quantity", "sum"),
                antiguedad_promedio=("age_years", "mean"),
                num_clientes=("customer", "nunique"),
            )
            .reset_index()
            .sort_values("cantidad_total", ascending=False)
        )
        st.dataframe(pivot, use_container_width=True, hide_index=True)
