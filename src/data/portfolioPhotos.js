const portfolioPhotoCount = 20;
const portfolioPhotos = Array.from(
    { length: portfolioPhotoCount },
    (_, index) => `/assets/Pictures/SlideShow4Portfolio/PortfolioPic${index + 1}.JPG`
);

export default portfolioPhotos;
