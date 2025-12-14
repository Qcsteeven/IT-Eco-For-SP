import Image from "next/image";
import "./intro-block.scss"


export default function IntroBlock() {
  return (
    <div className="intro-block">
      <Image
        className="ib-img"
        src="/mainpage.jpg"
        alt="intro img"
        width="1738"
        height="877"
      />
      <form className="ib-subscribe" action="/home" method="post">
        <h2 className="ib-title">Получите уведомления о соревнованиях первыми</h2>
        <input
          className="ib-tg"
          type="text"
          name="tg"
          placeholder="https://t.me/username или @username"
        />
        <label className="ib-cb-st">
          <input className="ib-cb" type="checkbox" name="cb"/>
          <span className="ib-small-text">
            Нажимая кнопку «Отправить», даю согласие на обработку персональных данных и соглашаюсь c политикой конфиденциальности.
          </span>
        </label>
        <button className="ib-btn" type="submit">Отправить</button>
      </form>
    </div>
  )
}