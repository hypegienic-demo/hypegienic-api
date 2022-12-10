import {registerFont, Image} from 'canvas'

import SourceSansPro from '../../asset/font/sourcesanspro.otf'

export const registerFonts = () => {
  registerFont(SourceSansPro, {family:'SourceSansPro'})
}

export const canvasStyle = {
  font: (size:number) =>
    `${size}px SourceSansPro`,
  primaryColor: (opacity = 1) =>
    `rgba(33, 150, 243, ${opacity})`,
  textColor: (opacity = 1) =>
    `rgba(170, 170, 170, ${opacity})`
}

export const alignCenterImage = (image:Image, max:{width:number, height:number}, center:{x:number, y:number}, mode:'contain' | 'cover' = 'contain') => {
  const follow = (dimension:'height' | 'width') => {
    if(dimension === 'height') {
      return [image.width / image.height * max.height, max.height] as const
    } else {
      return [max.width, image.height / image.width * max.width] as const
    }
  }
  const [calcWidth, calcHeight] = (() => {
    if(max.height / max.width < image.height / image.width) {
      if(mode === 'contain') return follow('height')
      else return follow('width')
    } else {
      if(mode === 'contain') return follow('width')
      else return follow('height')
    }
  })()
  return [image, center.x - (calcWidth / 2), center.y - (calcHeight / 2), calcWidth, calcHeight] as const
}