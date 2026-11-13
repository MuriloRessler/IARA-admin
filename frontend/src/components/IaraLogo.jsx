import logoSource from '../assets/branding/logo-iara-cropped.png';

export function IaraLogo({ variant = 'compact', className = '', alt = 'Logo IARA' }) {
  return <img className={`iara-logo iara-logo--${variant} ${className}`.trim()} src={logoSource} alt={alt} />;
}
