import { useState, useEffect, useCallback } from 'react';
import { Phone, Mail, MessageCircle, Truck, Shield, Bug, Droplets, CheckCircle } from 'lucide-react';
import { supabase } from './lib/supabase';

interface Product {
  id: string;
  name: string;
  volume: string;
  price: number;
  quantity: number;
}

interface Municipality {
  name: string;
  zone: 'abidjan' | 'outlying' | 'outside';
  deliveryFee: number;
}

const municipalities: Municipality[] = [
  // Abidjan - 1,500 CFA
  { name: 'Abobo', zone: 'abidjan', deliveryFee: 1500 },
  { name: 'Adjamé', zone: 'abidjan', deliveryFee: 1500 },
  { name: 'Attécoubé', zone: 'abidjan', deliveryFee: 1500 },
  { name: 'Cocody', zone: 'abidjan', deliveryFee: 1500 },
  { name: 'Koumassi', zone: 'abidjan', deliveryFee: 1500 },
  { name: 'Marcory', zone: 'abidjan', deliveryFee: 1500 },
  { name: 'Le Plateau', zone: 'abidjan', deliveryFee: 1500 },
  { name: 'Port-Bouët', zone: 'abidjan', deliveryFee: 1500 },
  { name: 'Treichville', zone: 'abidjan', deliveryFee: 1500 },
  { name: 'Yopougon', zone: 'abidjan', deliveryFee: 1500 },
  // Outlying - 2,000 CFA
  { name: 'Anyama', zone: 'outlying', deliveryFee: 2000 },
  { name: 'Bingerville', zone: 'outlying', deliveryFee: 2000 },
  { name: 'Songon', zone: 'outlying', deliveryFee: 2000 },
  // Outside Abidjan - 3,000 CFA
  { name: 'Autres communes (Hors Abidjan)', zone: 'outside', deliveryFee: 3000 },
];

// Fonction pour enregistrer la commande dans Supabase
async function saveOrderToSupabase(order: { [key: string]: any }, items: Array<{ [key: string]: any }>) {
  // 1. Insérer la commande principale
  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .insert([order])
    .select()
    .single();

  if (orderError) {
    console.error('Erreur lors de la création de la commande:', orderError);
    return false;
  }

  // 2. Insérer les items de la commande
  const orderItems = items.map((item: { [key: string]: any }) => ({
    order_id: orderData.id,
    product_name: item.name,
    quantity: item.quantity,
    price: item.price
  }));

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItems);

  if (itemsError) {
    console.error("Erreur lors de l'ajout des produits:", itemsError);
    return false;
  }

  return true;
}

function App() {
  const [products, setProducts] = useState<Product[]>([
    { id: '100ml', name: 'Sniper DDVP 100ml', volume: '100ml', price: 2500, quantity: 0 },
    { id: '250ml', name: 'Sniper DDVP 250ml', volume: '250ml', price: 6000, quantity: 0 },
  ]);
  
  const [dosingKitQuantity, setDosingKitQuantity] = useState(0);
  const [selectedMunicipality, setSelectedMunicipality] = useState<Municipality | null>(null);
  const [customerInfo, setCustomerInfo] = useState({
    fullName: '',
    phone: ''
  });
  
  const [totals, setTotals] = useState({
    subtotal: 0,
    dosingKit: 0,
    delivery: 0,
    total: 0,
    isFreeDelivery: false
  });
  
  const [productImageUrl, setProductImageUrl] = useState<string>('');
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [showThankYou, setShowThankYou] = useState(false);

  const dosingKitPrice = 1000;

  // Get product image from Supabase Storage
  useEffect(() => {
    const getProductImage = async () => {
      try {
        const { data } = supabase.storage
          .from('products')
          .getPublicUrl('sniper_bottle.jpg');
        
        setProductImageUrl(data.publicUrl);
      } catch (error) {
        console.error('Error loading product image:', error);
        // Fallback to placeholder if image fails to load
        setProductImageUrl('https://via.placeholder.com/200x200?text=Sniper+DDVP');
      }
    };
    
    const getLogo = async () => {
      try {
        const { data } = supabase.storage
          .from('products')
          .getPublicUrl('logo_stopunaise.png');
        
        setLogoUrl(data.publicUrl);
      } catch (error) {
        console.error('Error loading logo:', error);
      }
    };
    
    getProductImage();
    getLogo();
  }, []);
  const updateProductQuantity = (productId: string, newQuantity: number) => {
    setProducts(products.map(product => 
      product.id === productId ? { ...product, quantity: Math.max(0, newQuantity) } : product
    ));
  };

  const calculateTotals = useCallback(() => {
    // Forcer les valeurs à être des nombres
    const subtotal = products.reduce((sum, product) => sum + (Number(product.price) * Number(product.quantity)), 0);
    const dosingKit = Number(dosingKitQuantity) * Number(dosingKitPrice);
    // Calcul du volume total
    const totalVolume = products.reduce((sum, product) => {
      const volume = parseInt(product.volume.replace('ml', ''));
      return sum + (volume * Number(product.quantity));
    }, 0);
    const isFreeDelivery = totalVolume >= 500;
    // Calcul du delivery sécurisé
    const delivery = selectedMunicipality ? (isFreeDelivery ? 0 : Number(selectedMunicipality.deliveryFee)) : 0;
    // Calcul du total sécurisé
    const total = Number(subtotal) + Number(dosingKit) + Number(delivery);
    // Log pour debug
    console.log('subtotal:', subtotal, 'dosingKit:', dosingKit, 'delivery:', delivery, 'total:', total);
    setTotals({
      subtotal,
      dosingKit,
      delivery,
      total,
      isFreeDelivery
    });
  }, [products, dosingKitQuantity, selectedMunicipality, dosingKitPrice]);

  useEffect(() => {
    calculateTotals();
  }, [calculateTotals]);

  const generateOrderSummary = () => {
    const orderItems = products.filter(p => p.quantity > 0)
      .map(p => `${p.name} x${p.quantity} = ${(p.price * p.quantity).toLocaleString()} CFA`)
      .join('\n');
    
    const dosingKitText = dosingKitQuantity > 0 ? `Kit de dosage x${dosingKitQuantity}: ${(dosingKitQuantity * dosingKitPrice).toLocaleString()} CFA` : '';
    const deliveryText = totals.isFreeDelivery
      ? `Livraison: GRATUITE (500ml ou plus)` 
      : `Livraison (${selectedMunicipality?.name}): ${totals.delivery.toLocaleString()} CFA`;
    
    return `🛒 COMMANDE SNIPER DDVP

👤 Client: ${customerInfo.fullName}
📱 Téléphone: ${customerInfo.phone}
📍 Commune: ${selectedMunicipality?.name}

📦 Produits:
${orderItems}

${dosingKitText}
${deliveryText}

💰 TOTAL: ${totals.total.toLocaleString()} CFA FRANCS

Merci pour votre commande !`;
  };

  const handleWhatsAppOrder = async () => {
    const order = {
      full_name: customerInfo.fullName,
      phone: customerInfo.phone,
      municipality: selectedMunicipality?.name || '',
      total: totals.total
    };
    // Ajout du kit de dosage comme produit si quantité > 0
    const items = [
      ...products.filter(p => p.quantity > 0),
      ...(dosingKitQuantity > 0
        ? [{ name: 'Kit de dosage', price: dosingKitPrice, quantity: dosingKitQuantity }]
        : [])
    ];
    const success = await saveOrderToSupabase(order, items);
    if (!success) {
      alert('Erreur lors de l\'enregistrement de la commande. Veuillez réessayer.');
      return;
    }
    const message = encodeURIComponent(generateOrderSummary());
    const whatsappUrl = `https://wa.me/+2250556520604?text=${message}`;
    window.location.href = whatsappUrl; // Redirection pour compatibilité mobile
    setShowThankYou(true);
    // Réinitialisation des champs après la commande
    setProducts([
      { id: '100ml', name: 'Sniper DDVP 100ml', volume: '100ml', price: 2500, quantity: 0 },
      { id: '250ml', name: 'Sniper DDVP 250ml', volume: '250ml', price: 6000, quantity: 0 },
    ]);
    setDosingKitQuantity(0);
    setSelectedMunicipality(null);
    setCustomerInfo({ fullName: '', phone: '' });
  };

  const isOrderValid = () => {
    const hasProducts = products.some(p => p.quantity > 0);
    const hasCustomerInfo = customerInfo.fullName.trim() && customerInfo.phone.trim();
    const hasMunicipality = selectedMunicipality !== null;
    return hasProducts && hasCustomerInfo && hasMunicipality;
  };

  // Ajout du log pour debug juste avant le return
  console.log('AFFICHAGE totals:', totals);
  if (showThankYou) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow-lg p-10 text-center">
          <h2 className="text-3xl font-bold text-green-600 mb-4">Merci pour votre commande !</h2>
          <p className="text-lg text-gray-700 mb-6">Nous avons bien reçu votre demande. Un conseiller vous contactera très bientôt pour finaliser la livraison.</p>
          <button
            className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            onClick={() => setShowThankYou(false)}
          >
            Revenir à la page de commande
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-20 w-20 object-contain" />
              ) : (
                <Bug className="h-8 w-8 text-red-600" />
              )}
              
            </div>
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">Protection Garantie</span>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center bg-red-600 text-white px-4 py-2 rounded-full text-sm font-medium mb-6">
            <span className="mr-2">🆕</span>
            NOUVEAU PRODUIT
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Sniper DDVP
          </h2>
          <p className="text-xl md:text-2xl mb-8 opacity-90">
            La solution radicale contre les nuisibles!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5" />
              <span>Efficacité immédiate</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5" />
              <span>Longue durée</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5" />
              <span>Usage professionnel</span>
            </div>
          </div>
        </div>
      </section>

      {/* Product Selection */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-gray-900 mb-4">Choisissez votre format</h3>
            <p className="text-lg text-gray-600">Sélectionnez la quantité adaptée à vos besoins</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {products.map((product) => (
              <div key={product.id} className="bg-gray-50 rounded-xl p-6 border-2 border-gray-200 hover:border-blue-500 transition-all duration-300">
                <div className="text-center mb-6">
                  <div className="inline-block bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium mb-4">
                    NOUVEAU
                  </div>
                  <div className="w-32 h-32 mx-auto mb-4 rounded-xl overflow-hidden bg-white border border-gray-200">
                    <img 
                      src={productImageUrl || 'https://via.placeholder.com/200x200?text=Loading...'}
                      alt={product.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <h4 className="text-xl font-bold text-gray-900 mb-2">{product.name}</h4>
                  <p className="text-3xl font-bold text-blue-600 mb-4">{product.price.toLocaleString()} CFA</p>
                </div>
                
                <div className="flex items-center justify-center space-x-4">
                  <button
                    onClick={() => updateProductQuantity(product.id, product.quantity - 1)}
                    className="w-10 h-10 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center transition-colors"
                    disabled={product.quantity <= 0}
                  >
                    <span className="text-lg font-bold">−</span>
                  </button>
                  <span className="text-2xl font-bold w-16 text-center">{product.quantity}</span>
                  <button
                    onClick={() => updateProductQuantity(product.id, product.quantity + 1)}
                    className="w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center transition-colors"
                  >
                    <span className="text-lg font-bold">+</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Dosing Kit Option */}
          <div className="max-w-2xl mx-auto mt-12 bg-blue-50 rounded-xl p-6 border border-blue-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Droplets className="h-5 w-5 text-blue-600" />
                <span className="text-lg font-medium text-gray-900">Kit de dosage professionnel</span>
              </div>
              <span className="text-lg font-bold text-blue-600">{dosingKitPrice.toLocaleString()} CFA / unité</span>
            </div>
            <p className="text-sm text-gray-600 mb-4">Kit professionnel pour un dosage précis et sécurisé</p>
            
            <div className="flex items-center justify-center space-x-4">
              <button
                onClick={() => setDosingKitQuantity(Math.max(0, dosingKitQuantity - 1))}
                className="w-10 h-10 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center transition-colors"
                disabled={dosingKitQuantity <= 0}
              >
                <span className="text-lg font-bold">−</span>
              </button>
              <div className="text-center">
                <span className="text-2xl font-bold w-16 inline-block">{dosingKitQuantity}</span>
                <p className="text-xs text-gray-500 mt-1">
                  {dosingKitQuantity > 0 ? `Total: ${(dosingKitQuantity * dosingKitPrice).toLocaleString()} CFA` : 'Aucun kit'}
                </p>
              </div>
              <button
                onClick={() => setDosingKitQuantity(dosingKitQuantity + 1)}
                className="w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center transition-colors"
              >
                <span className="text-lg font-bold">+</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Order Form */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-gray-900 mb-4">Informations de livraison</h3>
            <p className="text-lg text-gray-600">Remplissez vos coordonnées pour finaliser votre commande</p>
          </div>

          <div className="bg-white rounded-xl p-8 shadow-sm">
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom complet *
                </label>
                <input
                  type="text"
                  value={customerInfo.fullName}
                  onChange={(e) => setCustomerInfo({...customerInfo, fullName: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Votre nom complet"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Numéro de téléphone *
                </label>
                <input
                  type="tel"
                  value={customerInfo.phone}
                  onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="+225 XX XX XX XX XX"
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Commune de livraison *
              </label>
              <select
                value={selectedMunicipality?.name || ''}
                onChange={(e) => {
                  const municipality = municipalities.find(m => m.name === e.target.value);
                  setSelectedMunicipality(municipality || null);
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value="">Sélectionnez votre commune</option>
                <optgroup label="Abidjan (1,500 CFA)">
                  {municipalities.filter(m => m.zone === 'abidjan').map(m => (
                    <option key={m.name} value={m.name}>{m.name}</option>
                  ))}
                </optgroup>
                <optgroup label="Communes périphériques (2,000 CFA)">
                  {municipalities.filter(m => m.zone === 'outlying').map(m => (
                    <option key={m.name} value={m.name}>{m.name}</option>
                  ))}
                </optgroup>
                <optgroup label="Hors Abidjan (3,000 CFA)">
                  {municipalities.filter(m => m.zone === 'outside').map(m => (
                    <option key={m.name} value={m.name}>{m.name}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Delivery Info */}
            {selectedMunicipality && (
              <div className="bg-blue-50 rounded-lg p-4 mb-6">
                <div className="flex items-center space-x-2 mb-2">
                  <Truck className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-blue-900">Information de livraison</span>
                </div>
                <p className="text-sm text-blue-700">
                  Livraison à {selectedMunicipality.name}: {selectedMunicipality.deliveryFee.toLocaleString()} CFA
                </p>
                {totals.isFreeDelivery && (
                  <p className="text-sm text-green-700 font-medium mt-1">
                    🎉 Livraison GRATUITE (500ml ou plus)
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Price Summary */}
      <section className="py-16 bg-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gray-50 rounded-xl p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">Récapitulatif de commande</h3>
            
            <div className="space-y-4">
              {products.filter(p => p.quantity > 0).map(product => (
                <div key={product.id} className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-gray-700">{product.name} x{product.quantity}</span>
                  <span className="font-medium">{(product.price * product.quantity).toLocaleString()} CFA</span>
                </div>
              ))}
              
              {dosingKitQuantity > 0 && (
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-gray-700">Kit de dosage x{dosingKitQuantity}</span>
                  <span className="font-medium">{(dosingKitQuantity * dosingKitPrice).toLocaleString()} CFA</span>
                </div>
              )}
              
              {selectedMunicipality && (
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-gray-700">
                    Livraison {totals.isFreeDelivery ? '(GRATUITE - 500ml+)' : `(${selectedMunicipality.name})`}
                  </span>
                  <span className={`font-medium ${totals.isFreeDelivery ? 'text-green-600' : ''}`}>
                    {totals.isFreeDelivery ? '0' : totals.delivery.toLocaleString()} CFA
                  </span>
                </div>
              )}
              
              <div className="flex justify-between items-center pt-4 border-t-2 border-gray-300">
                <span className="text-xl font-bold text-gray-900">TOTAL</span>
                <span className="text-2xl font-bold text-blue-600">{totals.total.toLocaleString()} CFA</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Order Finalization */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-3xl font-bold text-gray-900 mb-8">Finaliser votre commande</h3>
          
          <div className="flex justify-center">
            <button
              onClick={handleWhatsAppOrder}
              disabled={!isOrderValid()}
              className="flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-8 py-4 rounded-xl font-medium transition-colors"
            >
              <MessageCircle className="h-5 w-5" />
              <span>Commander via WhatsApp</span>
            </button>
          </div>
          
          {!isOrderValid() && (
            <p className="text-red-600 mt-4 text-sm">
              Veuillez sélectionner au moins un produit, remplir vos informations et choisir une commune de livraison.
            </p>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-10 w-10 object-contain" />
            ) : (
              <Bug className="h-6 w-6" />
            )}
            <span className="text-xl font-bold">Stopunaise</span>
          </div>
          <p className="text-gray-400 mb-4">Protection professionnelle garantie</p>
          <div className="flex items-center justify-center space-x-6">
            <div className="flex items-center space-x-2">
              <Phone className="h-4 w-4" />
              <span className="text-sm">+225 05 84 75 37 43 / 05 56 52 06 04</span>
            </div>
            <div className="flex items-center space-x-2">
              <Mail className="h-4 w-4" />
              <span className="text-sm">stopunaise225@gmail.com</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;