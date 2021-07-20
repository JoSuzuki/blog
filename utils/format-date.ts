type unix = number

const formatDate = (date: string | unix): string => {
  const jsDate = new Date(date)

  return `${jsDate.getDate()}/${jsDate.getMonth() + 1}/${jsDate.getFullYear()}`
}

export default formatDate
