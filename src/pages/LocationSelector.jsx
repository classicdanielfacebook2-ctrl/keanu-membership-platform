import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getApplicationDraft, updateApplicationDraft } from "../services/applicationDraft.js";

const selectorConfig = {
  country: {
    title: "Select Country",
    placeholder: "Search country",
    empty: "No country found."
  },
  state: {
    title: "Select State / Region",
    placeholder: "Search state or region",
    empty: "No state or region found."
  },
  city: {
    title: "Select City",
    placeholder: "Search city",
    empty: "No city found."
  }
};

export default function LocationSelector({ type }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [locationApi, setLocationApi] = useState(null);
  const draft = getApplicationDraft();
  const config = selectorConfig[type] || selectorConfig.country;

  useEffect(() => {
    let active = true;
    import("country-state-city").then((module) => {
      if (!active) return;
      setLocationApi({ Country: module.Country, State: module.State, City: module.City });
    });

    return () => {
      active = false;
    };
  }, []);

  const options = useMemo(() => {
    if (!locationApi) return [];

    if (type === "country") {
      return locationApi.Country.getAllCountries().map((country) => ({
        value: country.isoCode,
        label: country.name,
        meta: country.flag || country.isoCode
      }));
    }

    if (type === "state") {
      if (!draft.countryCode) return [];
      return [
        ...locationApi.State.getStatesOfCountry(draft.countryCode).map((state) => ({
          value: state.isoCode,
          label: state.name,
          meta: state.isoCode
        })),
        { value: "__manual_state__", label: "State / region not listed", meta: "Type manually" }
      ];
    }

    if (!draft.countryCode || !draft.stateCode || draft.stateCode === "__manual_state__") {
      return [{ value: "__manual__", label: "City not listed", meta: "Type manually" }];
    }

    return [
      ...locationApi.City.getCitiesOfState(draft.countryCode, draft.stateCode).map((city) => ({
        value: city.name,
        label: city.name,
        meta: city.stateCode || draft.stateCode
      })),
      { value: "__manual__", label: "City not listed", meta: "Type manually" }
    ];
  }, [draft.countryCode, draft.stateCode, locationApi, type]);

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;

    return options.filter((option) => `${option.label} ${option.meta || ""}`.toLowerCase().includes(normalized));
  }, [options, query]);

  const currentValue = type === "country" ? draft.countryCode : type === "state" ? draft.stateCode : draft.city;

  const goBack = () => navigate("/apply", { replace: true });

  const selectOption = (option) => {
    if (type === "country") {
      updateApplicationDraft({
        countryCode: option.value,
        country: option.label,
        stateCode: "",
        stateRegion: "",
        manualStateRegion: "",
        city: "",
        manualCity: ""
      });
    } else if (type === "state") {
      updateApplicationDraft({
        stateCode: option.value,
        stateRegion: option.label,
        manualStateRegion: "",
        city: "",
        manualCity: ""
      });
    } else {
      updateApplicationDraft({
        city: option.value,
        manualCity: option.value === "__manual__" ? draft.manualCity || "" : ""
      });
    }

    goBack();
  };

  const useTypedValue = () => {
    const typed = query.trim();
    if (!typed) return;

    if (type === "state") {
      updateApplicationDraft({
        stateCode: "__manual_state__",
        stateRegion: "State / region not listed",
        manualStateRegion: typed,
        city: "",
        manualCity: ""
      });
    } else if (type === "city") {
      updateApplicationDraft({
        city: "__manual__",
        manualCity: typed
      });
    }

    goBack();
  };

  return (
    <section className="selector-screen">
      <header className="selector-screen-header">
        <button type="button" onClick={goBack} aria-label="Back to application">
          <ArrowLeft size={18} />
          Back
        </button>
        <h1>{config.title}</h1>
      </header>

      <div className="selector-search">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={config.placeholder} />
      </div>

      <div className="selector-results">
        {!locationApi ? <p>Loading options...</p> : null}
        {locationApi && filteredOptions.length === 0 ? <p>{config.empty}</p> : null}
        {locationApi && query.trim() && (type === "state" || type === "city") ? (
          <button className="typed-selector-option" type="button" onClick={useTypedValue}>
            <span>Use "{query.trim()}"</span>
            <small>Manual entry</small>
          </button>
        ) : null}
        {filteredOptions.map((option) => (
          <button
            key={option.value}
            className={option.value === currentValue ? "selected" : ""}
            type="button"
            onClick={() => selectOption(option)}
          >
            <span>{option.label}</span>
            {option.meta ? <small>{option.meta}</small> : null}
            {option.value === currentValue ? <Check size={17} /> : null}
          </button>
        ))}
      </div>
    </section>
  );
}
