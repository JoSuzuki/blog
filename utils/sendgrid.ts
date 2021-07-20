import sgMail from '@sendgrid/mail'

sgMail.setApiKey(process.env.SENDGRID_API_KEY as string)

const sendEmail = ({
  to,
  subject,
  html,
  text,
}: {
  to: string
  subject: string
  html: string
  text: string
}) => {
  sgMail
    .send({
      to,
      from: 'jonathan@suzuki.pro.br',
      subject,
      text,
      html,
    })
    .catch((error) => {
      console.error(error)
    })
}

export const notifyComment = ({
  author,
  comment,
  post,
}: {
  author: string
  comment: string
  post: string
}) => {
  sendEmail({
    to: 'jonathan@suzuki.pro.br',
    subject: `Novo comentário de ${author} em ${post} do JoSuzuki`,
    html: `
    <p>
      <strong>${author}</strong> comentou em ${post}:
    </p>
    <p>${comment}</p>
    <p>
      <a href="https://josuzuki.me${post}" target="_blank" rel="noopener noreferrer">Post</a> - JoSuzuki
    </p>`,
    text: `${comment}`,
  })
}

export default sendEmail
