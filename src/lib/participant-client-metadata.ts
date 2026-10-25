export type ParticipantClientMetadata = {
  browserLocale: string;
  timezone: string;
  deviceType: "mobile" | "tablet" | "desktop";
  browser: string;
  operatingSystem: string;
  screenWidth: number;
  screenHeight: number;
};

const detectBrowser = (userAgent: string) => {
  if (/SamsungBrowser/i.test(userAgent)) return "Samsung Internet";
  if (/Edg\//i.test(userAgent)) return "Edge";
  if (/OPR\//i.test(userAgent)) return "Opera";
  if (/Firefox\//i.test(userAgent)) return "Firefox";
  if (/CriOS\//i.test(userAgent)) return "Chrome iOS";
  if (/Chrome\//i.test(userAgent)) return "Chrome";
  if (/Safari\//i.test(userAgent)) return "Safari";
  return "Other";
};

const detectOperatingSystem = (userAgent: string) => {
  if (/Android/i.test(userAgent)) return "Android";
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "iOS";
  if (/Windows/i.test(userAgent)) return "Windows";
  if (/Macintosh|Mac OS X/i.test(userAgent)) return "macOS";
  if (/Linux/i.test(userAgent)) return "Linux";
  return "Other";
};

const detectDeviceType = (
  userAgent: string,
  width: number,
): ParticipantClientMetadata["deviceType"] => {
  if (/iPad|Tablet/i.test(userAgent)) return "tablet";
  if (/Android/i.test(userAgent) && !/Mobile/i.test(userAgent)) return "tablet";
  if (/Mobi|iPhone|iPod|Android/i.test(userAgent) || width < 768)
    return "mobile";
  return "desktop";
};

export const collectParticipantClientMetadata =
  (): ParticipantClientMetadata => {
    const userAgent = navigator.userAgent;
    const screenWidth = Math.round(window.screen.width);
    const screenHeight = Math.round(window.screen.height);

    return {
      browserLocale: navigator.language || "unknown",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown",
      deviceType: detectDeviceType(userAgent, screenWidth),
      browser: detectBrowser(userAgent),
      operatingSystem: detectOperatingSystem(userAgent),
      screenWidth,
      screenHeight,
    };
  };
