const homePhotoCount = 6;
const homePhotos = Array.from(
    { length: homePhotoCount },
    (_, index) => `/assets/Pictures/SlideShow4BlogPics/img${index + 1}.jpg`
);

export default homePhotos;
