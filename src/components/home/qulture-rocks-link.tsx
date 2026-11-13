/** External link to qulture.rocks whose label is re-drawn on hover by a clip-path wipe. */
const QultureRocksLink = () => {
  return (
    <a
      href="https://www.qulture.rocks/"
      className={
        'relative border border-dashed border-[#cd90ff] font-grotesk font-bold text-text no-underline ' +
        "before:absolute before:top-[-3px] before:bg-[#cd90ff] before:text-black before:content-['qulture.rocks'] " +
        'before:[clip-path:polygon(1%_15%,1%_15%,0%_84%,0_84%)] before:[transition:clip-path_275ms_ease] ' +
        'hover:before:[clip-path:polygon(1%_15%,99%_15%,99%_84%,1%_84%)]'
      }
    >
      qulture.rocks
    </a>
  )
}

export default QultureRocksLink
