import logo from '../assets/statsbomb-logo.png'

/**
 * 공통 어트리뷰션 — StatsBomb Open Data 라이선스 §1.4 의무 표기.
 * 전 화면(S0~S5) 상시 노출, 작게·비침투적으로.
 */
export function Attribution({ className = '' }: { className?: string }) {
  return (
    <div className={`attribution ${className}`}>
      <img src={logo} alt="StatsBomb" className="attribution-logo" />
      <span>Data by StatsBomb Open Data</span>
    </div>
  )
}
