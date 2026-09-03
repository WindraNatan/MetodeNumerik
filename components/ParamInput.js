export default function ParamInput({ id, label, symbol, value, onChange, min, max, step }) {
  return (
    <div className="control-group" id={`control-${id}`}>
      <label className="control-label" htmlFor={`slider-${id}`}>
        <span>{label}</span>
        <code className="control-symbol">{symbol}</code>
      </label>
      <div className="slider-row">
        <input
          id={`slider-${id}`}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="slider"
        />
        <input
          id={`input-${id}`}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || min)}
          className="number-input"
        />
      </div>
      <div className="slider-range">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
