import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function AccountPageHeader({ title, copy, breadcrumbs = [], fallbackTo = "/account" }) {
  const navigate = useNavigate();

  const goBack = () => {
    if (window.history.state?.idx > 0) {
      navigate(-1);
      return;
    }
    navigate(fallbackTo, { replace: true });
  };

  return (
    <div className="account-page-header">
      <button className="account-back-button" type="button" onClick={goBack} aria-label="Go back">
        <ArrowLeft size={18} />
      </button>
      <div className="account-header-copy">
        {breadcrumbs.length ? (
          <nav className="account-breadcrumbs" aria-label="Account breadcrumb">
            {breadcrumbs.map((item, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <span key={`${item.label}-${index}`}>
                  {item.to && !isLast ? <Link to={item.to}>{item.label}</Link> : <strong>{item.label}</strong>}
                  {!isLast ? <em>/</em> : null}
                </span>
              );
            })}
          </nav>
        ) : null}
        <h1>{title}</h1>
        {copy ? <p>{copy}</p> : null}
      </div>
    </div>
  );
}
