import React from 'react';
import { 
    Carrot, Apple, Beef, Fish, Milk, 
    Droplet, Package, Wheat, Egg, 
    Cookie, Coffee, Pizza, Utensils
} from 'lucide-react';

export const getIngredientIcon = (category?: string, className?: string) => {
    if (!category) return <Package className={className} />;

    const cat = category.toLowerCase();
    
    if (cat.includes('채소') || cat.includes('야채') || cat.includes('버섯')) {
        return <Carrot className={className} />;
    }
    if (cat.includes('과일')) {
        return <Apple className={className} />;
    }
    if (cat.includes('고기') || cat.includes('육류') || cat.includes('돼지') || cat.includes('소') || cat.includes('닭')) {
        return <Beef className={className} />;
    }
    if (cat.includes('해산물') || cat.includes('수산물') || cat.includes('생선') || cat.includes('건어물')) {
        return <Fish className={className} />;
    }
    if (cat.includes('유제품') || cat.includes('우유') || cat.includes('치즈')) {
        return <Milk className={className} />;
    }
    if (cat.includes('소스') || cat.includes('조미료') || cat.includes('양념') || cat.includes('기름')) {
        return <Droplet className={className} />;
    }
    if (cat.includes('곡류') || cat.includes('쌀') || cat.includes('잡곡')) {
        return <Wheat className={className} />;
    }
    if (cat.includes('알') || cat.includes('계란') || cat.includes('달걀')) {
        return <Egg className={className} />;
    }
    if (cat.includes('과자') || cat.includes('간식') || cat.includes('빵')) {
        return <Cookie className={className} />;
    }
    if (cat.includes('음료') || cat.includes('차') || cat.includes('커피') || cat.includes('주류') || cat.includes('술')) {
        return <Coffee className={className} />;
    }
    if (cat.includes('가공식품') || cat.includes('밀키트') || cat.includes('인스턴트') || cat.includes('냉동')) {
        return <Pizza className={className} />;
    }
    if (cat.includes('면')) {
        return <Utensils className={className} />;
    }

    return <Package className={className} />;
};
