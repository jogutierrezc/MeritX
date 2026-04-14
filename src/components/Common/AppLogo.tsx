import React from 'react';

type AppLogoProps = {
  className?: string;
  imgClassName?: string;
  alt?: string;
};

const AppLogo: React.FC<AppLogoProps> = ({
  className = '',
  imgClassName = 'h-12 w-auto',
  alt = 'MeritX',
}) => {
  return (
    <div className={className}>
      <img src="/MeritX%20Logo.png" alt={alt} className={imgClassName} />
    </div>
  );
};

export default AppLogo;
