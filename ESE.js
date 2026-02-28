// ========================================================
// Firebase is loaded via <script> tags in ESE.html
// auth and db are initialised there and available globally
// ========================================================

// ---- Auth helpers ----
function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}

// ✅ On page load — hide everything, show only sign-in
document.addEventListener('DOMContentLoaded', function () {
    showPage('signin-page');
});

function showSignIn() { showPage('signin-page'); }
function showSignUp()  { showPage('signup-page'); }

function togglePassword() {
    const input = document.getElementById('signin-password');
    const icon  = document.getElementById('eye-icon');
    if (input.type === 'password') {
        input.type = 'text';
        icon.textContent = '🙈';
    } else {
        input.type = 'password';
        icon.textContent = '👁️';
    }
}

// ---- Sign In ----
async function handleSignIn() {
    const email    = document.getElementById('signin-email').value.trim();
    const password = document.getElementById('signin-password').value;
    const errEl    = document.getElementById('signin-error');
    const btn      = document.getElementById('signin-btn');

    if (!email || !password) {
        errEl.textContent = 'Please enter your email and password.';
        errEl.classList.remove('hidden');
        return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
        errEl.textContent = 'Please enter a valid email address.';
        errEl.classList.remove('hidden');
        return;
    }

    errEl.classList.add('hidden');
    if (btn) { btn.textContent = 'Signing in…'; btn.disabled = true; }

    try {
        if (!auth) throw { code: 'auth/not-configured', message: 'Firebase not configured.' };
        await auth.signInWithEmailAndPassword(email, password);
        showPage('irrigation-page');
    } catch (err) {
        errEl.textContent = friendlyError(err.code);
        errEl.classList.remove('hidden');
    } finally {
        if (btn) { btn.textContent = 'Sign In →'; btn.disabled = false; }
    }
}

// ---- Guest Sign In ----
async function handleGuestSignIn() {
    try {
        if (!auth) { showPage('irrigation-page'); return; }
        await auth.signInAnonymously();
        showPage('irrigation-page');
    } catch (err) {
        alert('Guest sign-in failed: ' + err.message);
    }
}

// ---- Sign Up ----
async function handleSignUp() {
    const name     = document.getElementById('signup-name').value.trim();
    const email    = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const btn      = document.getElementById('signup-btn');

    if (!name || !email || !password) {
        alert('Please fill in all fields.');
        return;
    }
    if (password.length < 6) {
        alert('Password must be at least 6 characters.');
        return;
    }

    if (btn) { btn.textContent = 'Creating account…'; btn.disabled = true; }

    try {
        if (!auth) throw { code: 'auth/not-configured', message: 'Firebase not configured.' };
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // 2. Set display name on Auth profile
        await user.updateProfile({ displayName: name });

        // 3. Save user data to Firestore → "users" collection
        await db.collection('users').doc(user.uid).set({
            uid:       user.uid,
            name:      name,
            email:     email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showPage('irrigation-page');
    } catch (err) {
        alert('Sign up failed: ' + friendlyError(err.code));
    } finally {
        if (btn) { btn.textContent = 'Create Account →'; btn.disabled = false; }
    }
}

// ---- Human-readable Firebase error messages ----
function friendlyError(code) {
    const messages = {
        'auth/not-configured':     'Firebase is not set up yet. Add your config to index.html.',
        'auth/user-not-found':       'No account found with this email.',
        'auth/wrong-password':       'Incorrect password. Please try again.',
        'auth/email-already-in-use': 'This email is already registered. Please sign in.',
        'auth/weak-password':        'Password must be at least 6 characters.',
        'auth/invalid-email':        'Please enter a valid email address.',
        'auth/too-many-requests':    'Too many failed attempts. Please try again later.',
        'auth/network-request-failed': 'Network error. Check your connection.',
    };
    return messages[code] || 'Something went wrong. Please try again.';
}

// ---- End Auth helpers ----

let largeState = {
    season: "",
    soil: "",
    irrigation: ""
};
let smallState = {
    season: "",
    soil: "",
    irrigation: ""
};
let currentMode = "";

const largeScaleDetails = {
    canal: {
        name: "Canal Irrigation",
        description: "A canal irrigation system is an artificial waterway network that diverts water from rivers, lakes, or reservoirs to agricultural fields, primarily using gravity. It consists of main canals, branch canals, and distributaries, providing a reliable, long-term water supply for consistent crop cultivation. These systems enhance food security, particularly in arid regions with low-level, fertile land"
    },
    tubewell: {
        name: "Tube Well Irrigation",
        description: "A tube well irrigation system is a sustainable, high-capacity method that uses a long, perforated pipe (usually PVC or metal) bored deep into an underground aquifer, typically 15 to over 100 meters, to extract groundwater. Powered by electric or diesel pumps, it provides consistent, year-round water for agriculture, often covering larger areas than open wells, though it carries risks of groundwater depletion and high initial costs."
    },
    dam: {
        name: "Dam/Reservoir Irrigation",
        description: "Dam/Reservoir irrigation systems involve constructing barriers across rivers to impound water, creating reservoirs that store excess wet-season water for release during dry periods. These systems enable controlled irrigation over vast, often remote agricultural lands, providing a reliable water supply that increases crop yields, enhances drought resistance, and often supports hydroelectric power and flood control."
    },
    riverlift: {
        name: "River Lift Irrigation",
        description: "A River Lift Irrigation (RLI) system is a method that lifts water from rivers or lower water sources using pumps and pipelines to irrigate higher elevation fields, bypassing the limitations of gravity-fed canals. It is essential for drought-prone, upland areas and involves pumping water into a delivery chamber for distribution."
    }
};

const smallScaleDetails = {
    home: {
        name: "Home Garden",
        description: "Home garden irrigation systems—principally drip irrigation and micro-sprinklers—deliver water directly to plant roots, maximizing efficiency and minimizing waste. Using a network of pipes, filters, and emitters connected to a water source (tap/tank), these systems ensure consistent moisture levels, save water, and reduce plant disease by avoiding overhead watering."
    },
    drip: {
        name: "Drip Irrigation",
        description: "A drip irrigation system is a highly efficient, pressurized method of delivering water and nutrients directly to a plant’s root zone through a network of valves, pipes, and emitters. By minimizing evaporation and runoff, it reduces water usage by up to 50% compared to traditional methods, promoting optimal plant health."
    },
    limited: {
        name: "Limited Water",
        description: "Limited Water Irrigation systems, often referred to as Micro-irrigation, Deficit Irrigation (DI), or precision irrigation, are advanced agricultural techniques designed to maximize water efficiency and crop yield when water resources are scarce. Instead of flooding entire fields, these systems deliver water directly to the plant's root zone, significantly reducing evaporation and runoff."
    },
    sprinkler: {
        name: "Sprinkler System",
        description: "A sprinkler system is a, pressurized irrigation method that simulates natural rainfall, using pipes, pumps, and nozzles to spray water over crops. It is designed for high water-use efficiency across varied terrains and soil types, reducing evaporation and labor compared to surface methods while allowing for uniform, controlled water application and fertilizer delivery."
    },
    wells: {
        name: "Wells & Bore",
        description: "Wells and boreholes (or borewells) are critical groundwater-based irrigation systems used to extract water from underground aquifers, supporting agriculture especially when surface water is scarce. They provide a reliable, independent, and often cost-effective water source, allowing farmers to irrigate in dry seasons and reduce reliance on rain."
    },
    rainwater: {
        name: "Rainwater Harvesting",
        description: "Rainwater harvesting in irrigation involves collecting, storing, and utilizing rainwater runoff—primarily from rooftops, land surfaces, or agricultural fields—to provide a sustainable water source for crops, reducing reliance on groundwater. It is a vital technique for increasing agricultural productivity in arid regions by mitigating water scarcity, soil erosion, and flooding."
    }
};

// LARGE SCALE CROPS
const largescaleCropDetails = {
    Rice: {
        name: "Rice",
        overview: "Staple Kharif crop for large-scale commercial farming",
        climate: "Warm and humid; 20–35°C with standing water",
        soil: "Clayey to loamy water-retaining soils",
        npk: "NPK 100–120:40–60:40 kg/ha",
        irrigation: ["Maintain 2–5 cm standing water", "Drain before harvest"],
        pests: ["Stem borer, leaf folder", "Use resistant varieties"]
    },
    Sugarcane: {
        name: "Sugarcane",
        overview: "Long-duration cash crop for large commercial farms",
        climate: "Tropical; 20–35°C with sunshine",
        soil: "Deep, fertile loam to clay loam",
        npk: "NPK 250:115:115 kg/ha",
        irrigation: ["Frequent irrigation during growth", "Critical at tillering and grand growth"],
        pests: ["Borers, white grub", "Use resistant varieties"]
    },
    Cotton: {
        name: "Cotton",
        overview: "Important fiber crop in Kharif season",
        climate: "Warm; 21–30°C with long frost-free period",
        soil: "Deep, well-drained black soils",
        npk: "NPK 150:75:75 kg/ha",
        irrigation: ["Based on soil moisture", "Drip irrigation beneficial"],
        pests: ["Bollworms, sucking pests", "Bt cultivars recommended"]
    },
    Wheat: {
        name: "Wheat",
        overview: "Cool-season cereal for large-scale production",
        climate: "Cool and dry; 15–25°C",
        soil: "Well-drained loamy to clay loam",
        npk: "NPK 120:60:40 kg/ha",
        irrigation: ["First at 20-25 days", "Then at tillering, jointing, flowering"],
        pests: ["Rusts and aphids", "Avoid waterlogging"]
    },
    Maize: {
        name: "Maize",
        overview: "Versatile cereal for commercial agriculture",
        climate: "Warm; 21–27°C with moisture",
        soil: "Well-drained fertile loams",
        npk: "NPK 120:60:40 kg/ha",
        irrigation: ["At knee-high, tasseling, grain-fill", "Avoid waterlogging early"],
        pests: ["Stem borers, fall armyworm", "Monitor and control early"]
    },
    Soybean: {
        name: "Soybean",
        overview: "Kharif oilseed and pulse crop",
        climate: "Warm and humid; 20–30°C",
        soil: "Well-drained black soils",
        npk: "NPK 20:40:40 kg/ha",
        irrigation: ["Based on rainfall", "Avoid waterlogging"],
        pests: ["Pod borers", "Use IPM"]
    },
    Groundnut: {
        name: "Groundnut",
        overview: "Oilseed crop for Kharif season",
        climate: "Warm; 20–30°C",
        soil: "Light sandy loam soils",
        npk: "NPK 20:40:40 kg/ha plus gypsum",
        irrigation: ["At flowering and pegging", "Avoid waterlogging"],
        pests: ["Leaf spot, rust", "Use resistant varieties"]
    },
    Millets: {
        name: "Millets",
        overview: "Drought-tolerant cereals",
        climate: "Hot and dry; tolerant to drought",
        soil: "Poor, light, marginal soils",
        npk: "NPK 40–60:20–30:20 kg/ha",
        irrigation: ["Supplemental at critical stages", "Often rainfed"],
        pests: ["Bird damage", "Use scare devices"]
    },
    Pulses: {
        name: "Pulses",
        overview: "Important for protein and soil fertility",
        climate: "Warm to moderate temperatures",
        soil: "Well-drained soils",
        npk: "Low nitrogen due to fixation",
        irrigation: ["Light irrigations at flowering", "Often rainfed"],
        pests: ["Pod borers", "Use IPM"]
    },
    Mustard: {
        name: "Mustard",
        overview: "Major Rabi oilseed crop",
        climate: "Cool season; 10–25°C",
        soil: "Well-drained loamy soils",
        npk: "NPK 80:40:40 kg/ha",
        irrigation: ["2-3 irrigations at key stages", "Avoid standing water"],
        pests: ["Aphids", "Use clean seed"]
    },
    Gram: {
        name: "Gram",
        overview: "Important Rabi pulse crop",
        climate: "Cool and dry; preferred",
        soil: "Well-drained loamy soils",
        npk: "NPK 20:40:20 kg/ha",
        irrigation: ["1-2 irrigations at critical stages", "Often rainfed"],
        pests: ["Pod borer", "Use traps and sprays"]
    },
    Barley: {
        name: "Barley",
        overview: "Hardy Rabi cereal crop",
        climate: "Cool and dry; tolerates salinity",
        soil: "Light soils, marginal lands",
        npk: "NPK 80:40:40 kg/ha",
        irrigation: ["Fewer than wheat", "Critical at heading"],
        pests: ["Foliar diseases", "Use seed treatment"]
    },
    Sorghum: {
        name: "Sorghum",
        overview: "Cereal and fodder crop",
        climate: "Drought and heat tolerant",
        soil: "Black and red loam soils",
        npk: "NPK 80:40:40 kg/ha",
        irrigation: ["Supplemental at critical stages", "Often rainfed"],
        pests: ["Shoot fly, stem borer", "Timely sowing helps"]
    },
    Oats: {
        name: "Oats",
        overview: "Cool season fodder and grain crop",
        climate: "Cool climate similar to wheat",
        soil: "Fertile loams with drainage",
        npk: "NPK 80:40:40 kg/ha",
        irrigation: ["At early growth and tillering", "Supplemental as needed"],
        pests: ["Leaf diseases", "Monitor for rust"]
    },
    Watermelon: {
        name: "Watermelon",
        overview: "Summer fruit crop",
        climate: "Hot and dry; frost sensitive",
        soil: "Light sandy loam soils",
        npk: "NPK 80:40:60 kg/ha",
        irrigation: ["Frequent during flowering", "Avoid water stress"],
        pests: ["Fruit fly, wilt diseases", "Monitor closely"]
    },
    Muskmelon: {
        name: "Muskmelon",
        overview: "Summer cucurbit crop",
        climate: "Warm with sunshine",
        soil: "Well-drained sandy loam",
        npk: "NPK 80:40:40 kg/ha",
        irrigation: ["Light but frequent", "Avoid wetting foliage late"],
        pests: ["Downy mildew, fruit flies", "Monitor regularly"]
    },
    Vegetables: {
        name: "Vegetables",
        overview: "Mixed vegetable crops",
        climate: "Varies by crop type",
        soil: "Fertile loamy soils",
        npk: "Moderate to high demand",
        irrigation: ["Uniform soil moisture", "Drip systems ideal"],
        pests: ["Sucking insects, borers", "Use crop rotation"]
    },
    Mango: {
        name: "Mango",
        overview: "Perennial fruit tree",
        climate: "Tropical to subtropical",
        soil: "Well-drained deep black soils",
        npk: "NPK 100:50:50 kg/ha",
        irrigation: ["During flowering and fruit dev", "Reduce dry season to induce flowering"],
        pests: ["Fruit fly, anthracnose", "Use fungicides and insecticides"]
    },
    Cucurbits: {
        name: "Cucurbits",
        overview: "Vine crops include cucumber, gourd",
        climate: "Warm season; needs sunshine",
        soil: "Well-drained sandy loam",
        npk: "NPK 80:40:40 kg/ha",
        irrigation: ["Frequent during flowering", "Avoid wetting foliage"],
        pests: ["Powdery mildew, fruit flies", "Use netting protection"]
    }
};

// SMALL SCALE CROPS
const smallscaleCropDetails = {
    Tomato: {
        name: "Tomato",
        overview: "High-value vegetable for small-scale drip systems",
        climate: "Warm; 20–25°C",
        soil: "Fertile loamy soil with good drainage",
        npk: "NPK 150:100:100 kg/ha",
        irrigation: ["Drip irrigation 2-3 days", "Consistent soil moisture", "Avoid leaf wetting"],
        pests: ["Fruit borer, leaf curl virus", "Adequate ventilation helps"]
    },
    Lentil: {
        name: "Lentil",
        overview: " A highly nutritious, protein-rich, cool-season pulse crop; acts as a, soil-enriching, drought-tolerant, and low-input legume",
        climate: "Cool-season crop (18–30°C)",
        soil: "Well-drained loamy to sandy loam soils with a pH of 5.5 to 7.5",
        npk: "20:40:20 kg/ha (N:P:K).",
        irrigation: ["Mostly grown rainfed; critical stages are flower initiation and pod filling"],
        pests: ["Aphids, Pod borer, Wilt, Rust"]
    },
    Cucumber: {
        name: "Cucumber",
        overview: "Summer climbing vegetable",
        climate: "Warm; 20–25°C",
        soil: "Well-drained fertile loam",
        npk: "NPK 100:60:60 kg/ha",
        irrigation: ["Regular drip irrigation", "Keep soil consistently moist"],
        pests: ["Powdery mildew", "Downy mildew management"]
    },
    Okra: {
        name: "Okra",
        overview: "Heat-loving vegetable",
        climate: "Hot; 25–35°C",
        soil: "Well-drained loamy soil",
        npk: "NPK 100:60:60 kg/ha",
        irrigation: ["Regular but moderate water", "Drip preferred"],
        pests: ["Shoot and fruit borer", "Use neem spray"]
    },
    Bottle_Gourd: {
        name: "Bottle Gourd",
        overview: "Summer climbing vegetable",
        climate: "Warm; 25–35°C",
        soil: "Well-drained fertile soil",
        npk: "NPK 100:60:60 kg/ha",
        irrigation: ["Frequent during flowering", "Maintain soil moisture"],
        pests: ["Fruit fly, mildew", "Provide support"]
    },
    Chillies: {
        name: "Chillies",
        overview: "Medium-value crop for small-scale systems",
        climate: "Warm; 20–30°C",
        soil: "Well-drained loam with organic matter",
        npk: "NPK 120:80:100 kg/ha",
        irrigation: ["Drip irrigation 2-3 times weekly", "Avoid waterlogging"],
        pests: ["Die-back, fruit rot", "Proper drainage essential"]
    },
    Brinjal: {
        name: "Brinjal",
        overview: "Long-season solanaceous crop",
        climate: "Warm; 24–30°C",
        soil: "Well-drained fertile loam",
        npk: "NPK 120:80:100 kg/ha",
        irrigation: ["Regular drip irrigation", "Keep soil moist"],
        pests: ["Fruit and shoot borer", "Use Bt and IPM"]
    },
    Bitter_Gourd: {
        name: "Bitter Gourd",
        overview: "Medicinal climbing vegetable",
        climate: "Warm; 25–30°C",
        soil: "Well-drained soil",
        npk: "NPK 100:60:60 kg/ha",
        irrigation: ["Moderate regular water", "Drip preferred"],
        pests: ["Fruit fly", "Mildew management"]
    },
    Ridge_Gourd: {
        name: "Ridge Gourd",
        overview: "Climbing summer vegetable",
        climate: "Warm; 25–35°C",
        soil: "Well-drained fertile soil",
        npk: "NPK 100:60:60 kg/ha",
        irrigation: ["Frequent irrigation", "Support structure needed"],
        pests: ["Powdery mildew", "Fruit fly"]
    },
    Ginger: {
        name: "Ginger",
        overview: "High-value rhizome crop",
        climate: "Warm and humid; 25–30°C",
        soil: "Rich, well-drained soil",
        npk: "NPK 25:100:100 kg/ha",
        irrigation: ["Regular moisture critical", "Avoid waterlogging"],
        pests: ["Leaf blotch", "Root rot prevention"]
    },
    Turmeric: {
        name: "Turmeric",
        overview: "Medicinal rhizome crop",
        climate: "Warm and humid; 25–30°C",
        soil: "Well-drained fertile soil",
        npk: "NPK 40:80:80 kg/ha",
        irrigation: ["Regular moisture needed", "Good drainage essential"],
        pests: ["Leaf blotch", "Rhizome rot management"]
    },
    Green_Beans: {
        name: "Green Beans",
        overview: "Legume vegetable crop",
        climate: "Warm; 20–25°C",
        soil: "Well-drained loamy soil",
        npk: "NPK 20:60:60 kg/ha",
        irrigation: ["Regular drip irrigation", "Keep soil moist"],
        pests: ["Pod borer", "Use support structures"]
    },
    Pumpkin: {
        name: "Pumpkin",
        overview: "Large-fruited cucurbit",
        climate: "Warm; 25–30°C",
        soil: "Well-drained fertile soil",
        npk: "NPK 100:60:80 kg/ha",
        irrigation: ["Regular irrigation", "Provide support"],
        pests: ["Powdery mildew", "Fruit flies"]
    },
    Watermelon: {
        name: "Watermelon",
        overview: "Summer fruit for small plots",
        climate: "Hot and dry; 25–35°C",
        soil: "Light sandy loam",
        npk: "NPK 80:40:60 kg/ha",
        irrigation: ["Frequent during growth", "Drip preferred"],
        pests: ["Fruit fly, wilt", "Monitor closely"]
    },
    Muskmelon: {
        name: "Muskmelon",
        overview: "Summer fruit on small farms",
        climate: "Warm; 25–30°C",
        soil: "Well-drained sandy loam",
        npk: "NPK 80:40:60 kg/ha",
        irrigation: ["Regular watering", "Avoid wetting foliage"],
        pests: ["Mildew, fruit flies", "Regular monitoring"]
    },
    Papaya: {
        name: "Papaya",
        overview: "Fast-growing tropical fruit",
        climate: "Warm; 24–28°C",
        soil: "Well-drained soil",
        npk: "NPK 100:60:100 kg/ha",
        irrigation: ["Regular drip irrigation", "Drainage critical"],
        pests: ["Papaya ringspot", "Mites and whiteflies"]
    },
    Peanut: {
        name: "Peanut",
        overview: "Oilseed legume",
        climate: "Warm; 20–30°C",
        soil: "Light sandy loam ideal",
        npk: "NPK 20:40:40 kg/ha plus gypsum",
        irrigation: ["At critical stages", "Avoid waterlogging"],
        pests: ["Leaf spot", "Rot diseases"]
    },
    Carrot: {
        name: "Carrot",
        overview: "Root vegetable crop",
        climate: "Cool to moderate; 15–20°C",
        soil: "Light, well-drained loam",
        npk: "NPK 80:60:60 kg/ha",
        irrigation: ["Regular but moderate", "Avoid waterlogging"],
        pests: ["Leaf blight", "Root knot"]
    },
    Radish: {
        name: "Radish",
        overview: "Quick-growing root crop",
        climate: "Cool; 10–20°C",
        soil: "Well-drained loamy soil",
        npk: "NPK 60:40:40 kg/ha",
        irrigation: ["Light regular watering", "Keep soil moist"],
        pests: ["Leaf hoppers", "Minimal pest issues"]
    },
    Beet: {
        name: "BeetRoot",
        overview: "Nutritious root vegetable",
        climate: "Cool to moderate; 15–20°C",
        soil: "Well-drained fertile loam",
        npk: "NPK 80:60:100 kg/ha",
        irrigation: ["Regular moisture", "Avoid stress"],
        pests: ["Leaf spots", "Root diseases"]
    },
    Lettuce: {
        name: "Lettuce",
        overview: "Cool-season vegetable for home gardens",
        climate: "Cool; 15–20°C",
        soil: "Rich, well-drained loam",
        npk: "NPK 80:60:80 kg/ha",
        irrigation: ["Regular but not waterlogged", "Drip or sprinkler ideal"],
        pests: ["Aphids, whiteflies", "Use neem spray early"]
    },
    Cabbage: {
        name: "Cabbage",
        overview: "Cool-season leafy vegetable",
        climate: "Cool; 15–20°C",
        soil: "Rich, fertile loam",
        npk: "NPK 120:80:80 kg/ha",
        irrigation: ["Regular consistent moisture", "Critical for head formation"],
        pests: ["Diamondback moth", "Cabbage looper"]
    },
    Cauliflower: {
        name: "Cauliflower",
        overview: "Cool-season brassica",
        climate: "Cool; 15–20°C",
        soil: "Rich, fertile loam",
        npk: "NPK 150:100:100 kg/ha",
        irrigation: ["Consistent moisture critical", "Drip preferred"],
        pests: ["Cabbage moth", "Root knot"]
    },
    Broccoli: {
        name: "Broccoli",
        overview: "Nutritious cool-season crop",
        climate: "Cool; 15–20°C",
        soil: "Rich, well-drained loam",
        npk: "NPK 150:100:100 kg/ha",
        irrigation: ["Regular consistent water", "Drip system ideal"],
        pests: ["Cabbage moth", "Diamondback moth"]
    },
    Kale: {
        name: "Kale",
        overview: "Hardy leafy green",
        climate: "Cool; 10–20°C",
        soil: "Well-drained fertile soil",
        npk: "NPK 100:60:60 kg/ha",
        irrigation: ["Regular moisture", "Cold hardy"],
        pests: ["Aphids", "Minimal pest issues"]
    },
    Spinach: {
        name: "Spinach",
        overview: "Nutritious leafy vegetable for cool seasons",
        climate: "Cool; 10–20°C",
        soil: "Rich, well-draining loam",
        npk: "NPK 100:80:80 kg/ha",
        irrigation: ["Consistent moisture", "Drip system recommended"],
        pests: ["Leaf miners, aphids", "Early harvesting reduces pests"]
    },
    Fenugreek: {
        name: "Fenugreek",
        overview: "Medicinal and culinary herb",
        climate: "Cool season; 15–25°C",
        soil: "Well-drained loam",
        npk: "NPK 20:40:20 kg/ha",
        irrigation: ["Moderate watering", "Avoid waterlogging"],
        pests: ["Minimal issues", "Disease resistant"]
    },
    Coriander: {
        name: "Coriander",
        overview: "Aromatic spice herb",
        climate: "Cool; 15–25°C",
        soil: "Well-drained loam",
        npk: "NPK 60:40:40 kg/ha",
        irrigation: ["Light regular watering", "Drip preferred"],
        pests: ["Leaf blight", "Minimal pest issues"]
    },
    Parsley: {
        name: "Parsley",
        overview: "Culinary herb crop",
        climate: "Cool to moderate; 10–20°C",
        soil: "Well-drained fertile soil",
        npk: "NPK 80:60:60 kg/ha",
        irrigation: ["Regular watering", "Keep soil moist"],
        pests: ["Minimal pest issues", "Disease resistant"]
    },
    Peas: {
        name: "Peas",
        overview: "Cool-season legume",
        climate: "Cool; 15–20°C",
        soil: "Well-drained loamy soil",
        npk: "NPK 20:40:40 kg/ha",
        irrigation: ["Light regular water", "Avoid waterlogging"],
        pests: ["Pod borer", "Powdery mildew"]
    },
    Garlic: {
        name: "Garlic",
        overview: "Flavoring bulb crop",
        climate: "Cool; 10–20°C",
        soil: "Well-drained fertile loam",
        npk: "NPK 80:60:60 kg/ha",
        irrigation: ["Regular but moderate", "Good drainage critical"],
        pests: ["Thrips", "Purple blotch"]
    },
    Onion: {
        name: "Onion",
        overview: "Bulb vegetable crop",
        climate: "Cool to moderate; 15–25°C",
        soil: "Well-drained fertile loam",
        npk: "NPK 120:80:80 kg/ha",
        irrigation: ["Regular moderate water", "Critical for bulb formation"],
        pests: ["Thrips", "Pink root"]
    },
    Shallot: {
        name: "Shallot",
        overview: "Small bulb crop",
        climate: "Cool; 15–20°C",
        soil: "Well-drained soil",
        npk: "NPK 100:60:60 kg/ha",
        irrigation: ["Light regular water", "Good drainage needed"],
        pests: ["Thrips", "Root rot"]
    },
    Leek: {
        name: "Leek",
        overview: "Mild onion-like vegetable",
        climate: "Cool; 10–20°C",
        soil: "Well-drained fertile soil",
        npk: "NPK 100:60:60 kg/ha",
        irrigation: ["Regular consistent water", "Keep soil moist"],
        pests: ["Thrips", "Leaf blight"]
    },
    Potato: {
        name: "Potato",
        overview: "Staple root vegetable",
        climate: "Cool; 15–20°C",
        soil: "Well-drained fertile loam",
        npk: "NPK 150:100:150 kg/ha",
        irrigation: ["Regular consistent moisture", "Critical for tuber formation"],
        pests: ["Late blight", "Early blight"]
    },
    Sweet_Potato: {
        name: "Sweet Potato",
        overview: "Nutritious root crop",
        climate: "Warm; 24–29°C",
        soil: "Well-drained sandy loam",
        npk: "NPK 60:100:100 kg/ha",
        irrigation: ["Regular moderate water", "Avoid waterlogging"],
        pests: ["Whiteflies", "Storage rot"]
    },
    Turnip: {
        name: "Turnip",
        overview: "Cool-season root vegetable",
        climate: "Cool; 10–20°C",
        soil: "Well-drained fertile loam",
        npk: "NPK 80:60:60 kg/ha",
        irrigation: ["Regular watering", "Keep soil moist"],
        pests: ["Leaf hoppers", "Root knot"]
    },
    Basil: {
        name: "Basil",
        overview: "Aromatic culinary herb",
        climate: "Warm; 20–25°C",
        soil: "Well-drained soil with compost",
        npk: "NPK 60:40:40 kg/ha",
        irrigation: ["Regular light watering", "Container friendly"],
        pests: ["Minimal pest issues", "Good air circulation"]
    },
    Mint: {
        name: "Mint",
        overview: "Aromatic medicinal herb",
        climate: "Moderate; 15–25°C",
        soil: "Well-drained soil",
        npk: "NPK 60:40:40 kg/ha",
        irrigation: ["Regular watering", "Likes moisture"],
        pests: ["Minimal pest issues", "Spreads vigorously"]
    },
    Oregano: {
        name: "Oregano",
        overview: "Mediterranean aromatic herb",
        climate: "Warm; 20–25°C",
        soil: "Well-drained soil",
        npk: "NPK 40:40:40 kg/ha",
        irrigation: ["Moderate watering", "Drought tolerant"],
        pests: ["Minimal issues", "Pest resistant"]
    },
    Thyme: {
        name: "Thyme",
        overview: "Aromatic culinary herb",
        climate: "Cool to warm; 15–25°C",
        soil: "Well-drained sandy soil",
        npk: "NPK 40:40:40 kg/ha",
        irrigation: ["Light watering", "Drought tolerant"],
        pests: ["Minimal pest issues", "Hardy plant"]
    },
    Rosemary: {
        name: "Rosemary",
        overview: "Aromatic medicinal herb",
        climate: "Warm; 15–25°C",
        soil: "Well-drained sandy soil",
        npk: "NPK 40:40:40 kg/ha",
        irrigation: ["Light watering", "Drought tolerant"],
        pests: ["Minimal issues", "Hardy plant"]
    },
    Sage: {
        name: "Sage",
        overview: "Medicinal culinary herb",
        climate: "Cool to warm; 15–25°C",
        soil: "Well-drained soil",
        npk: "NPK 40:40:40 kg/ha",
        irrigation: ["Light to moderate water", "Drought tolerant"],
        pests: ["Minimal pest issues", "Easy to grow"]
    },
    Lavender: {
        name: "Lavender",
        overview: "Aromatic medicinal herb",
        climate: "Warm; 20–25°C",
        soil: "Well-drained sandy soil",
        npk: "NPK 40:40:40 kg/ha",
        irrigation: ["Light watering", "Drought tolerant"],
        pests: ["Minimal issues", "Pest resistant"]
    },
    Lemongrass: {
        name: "Lemongrass",
        overview: "Aromatic tropical herb",
        climate: "Warm; 25–30°C",
        soil: "Well-drained fertile soil",
        npk: "NPK 60:40:40 kg/ha",
        irrigation: ["Regular watering", "High moisture needs"],
        pests: ["Minimal issues", "Pest resistant"]
    },
    Dill: {
        name: "Dill",
        overview: "Feathery aromatic herb",
        climate: "Cool; 15–20°C",
        soil: "Well-drained soil",
        npk: "NPK 60:40:40 kg/ha",
        irrigation: ["Light regular watering", "Avoid waterlogging"],
        pests: ["Minimal pest issues", "Self-sows readily"]
    },
    Fennel: {
        name: "Fennel",
        overview: "Aromatic spice herb",
        climate: "Cool season; 15–20°C",
        soil: "Well-drained loam",
        npk: "NPK 60:40:40 kg/ha",
        irrigation: ["Light watering", "Avoid waterlogging"],
        pests: ["Minimal issues", "Disease resistant"]
    },
    Cumin: {
        name: "Cumin",
        overview: "Important spice crop",
        climate: "Cool to warm; 15–25°C",
        soil: "Well-drained loam",
        npk: "NPK 40:40:40 kg/ha",
        irrigation: ["Light watering", "Drought tolerant"],
        pests: ["Minimal pest issues", "Hardy crop"]
    },
    Cilantro: {
        name: "Cilantro",
        overview: "Quick-growing culinary herb",
        climate: "Cool; 15–20°C",
        soil: "Well-drained soil",
        npk: "NPK 60:40:40 kg/ha",
        irrigation: ["Regular light watering", "Succession planting ideal"],
        pests: ["Minimal issues", "Quick harvest"]
    },
    Chives: {
        name: "Chives",
        overview: "Onion-flavored herb",
        climate: "Cool to moderate; 10–20°C",
        soil: "Well-drained soil",
        npk: "NPK 60:40:40 kg/ha",
        irrigation: ["Regular watering", "Keep soil moist"],
        pests: ["Minimal pest issues", "Perennial"]
    },
    Green_Onion: {
        name: "Green Onion",
        overview: "Quick-growing onion tops",
        climate: "Cool to moderate; 15–20°C",
        soil: "Well-drained soil",
        npk: "NPK 80:60:60 kg/ha",
        irrigation: ["Regular watering", "Keep moist"],
        pests: ["Minimal issues", "Quick harvest"]
    },
    Stevia: {
        name: "Stevia",
        overview: "Natural sweetener crop",
        climate: "Warm; 20–30°C",
        soil: "Well-drained soil",
        npk: "NPK 60:40:60 kg/ha",
        irrigation: ["Regular moderate water", "Good drainage critical"],
        pests: ["Minimal issues", "High value crop"]
    },
    Aloe_Vera: {
        name: "Aloe Vera",
        overview: "Medicinal succulent",
        climate: "Hot and dry; 20–35°C",
        soil: "Well-drained sandy soil",
        npk: "NPK 40:40:40 kg/ha",
        irrigation: ["Light watering", "Drought tolerant"],
        pests: ["Minimal pest issues", "Low maintenance"]
    },
    Moringa: {
        name: "Moringa",
        overview: "Nutritious medicinal tree",
        climate: "Warm; 25–35°C",
        soil: "Well-drained soil",
        npk: "NPK 100:60:60 kg/ha",
        irrigation: ["Moderate watering", "Drought tolerant"],
        pests: ["Minimal issues", "High nutritional value"]
    },
    Drumstick: {
        name: "Drumstick",
        overview: "Vegetable pod tree",
        climate: "Warm; 25–35°C",
        soil: "Well-drained fertile soil",
        npk: "NPK 100:60:60 kg/ha",
        irrigation: ["Regular moderate water", "Support needed"],
        pests: ["Shoot and pod borer", "Monitor closely"]
    }
};

// LARGE SCALE CROP DATA
const cropDataLarge = {
    Kharif: {
        Alluvial: {
            crops: ["Rice", "Maize", "Sugarcane"],
            tips: ["Proper drainage", "IPM for pests", "Level fields"]
        },
        Black: {
            crops: ["Cotton", "Soybean", "Groundnut"],
            tips: ["Deep ploughing", "Avoid waterlogging", "Mulch application"]
        },
        Red: {
            crops: ["Groundnut", "Millets", "Pulses"],
            tips: ["Drip irrigation", "Organic manure", "Gypsum application"]
        },
        Sandy: {
            crops: ["Millets", "Groundnut"],
            tips: ["Frequent irrigation", "Mulching essential", "Windbreaks"]
        },
        Loamy: {
            crops: ["Rice", "Maize", "Cotton"],
            tips: ["Crop rotation", "Regular weeding", "Soil testing"]
        },
    },
    Rabi: {
        Alluvial: {
            crops: ["Wheat", "Mustard", "Gram"],
            tips: ["Proper irrigation", "Monitor pests", "Timely sowing"]
        },
        Black: {
            crops: ["Wheat", "Sorghum", "Gram"],
            tips: ["Moisture conservation", "Mulching", "Rotate crops"]
        },
        Red: {
            crops: ["Barley", "Pulses", "Mustard"],
            tips: ["Avoid over-irrigation", "Drought-tolerant", "Bunding"]
        },
        Sandy: {
            crops: ["Pulses", "Barley"],
            tips: ["Protect from winds", "Mulching", "Legumes"]
        },
        Loamy: {
            crops: ["Wheat", "Mustard", "Oats"],
            tips: ["High-yield varieties", "Critical irrigation", "Disease monitoring"]
        },
    },
    Summer: {
        Alluvial: {
            crops: ["Watermelon", "Muskmelon", "Vegetables"],
            tips: ["Drip irrigation", "Plastic mulch", "Staking"]
        },
        Black: {
            crops: ["Mango", "Vegetables"],
            tips: ["Mulch trees", "Wind protection", "Clean basins"]
        },
        Red: {
            crops: ["Millets", "Vegetables"],
            tips: ["Drought-tolerant", "Micro-irrigation", "Compost"]
        },
        Sandy: {
            crops: ["Cucurbits", "Pulses"],
            tips: ["Light irrigation", "Windbreaks", "Early varieties"]
        },
        Loamy: {
            crops: ["Muskmelon", "Vegetables", "Fodder"],
            tips: ["Crop rotation", "Pest monitoring", "Drainage"]
        },
    },
};

// SMALL SCALE CROP DATA
const cropDataSmall = {
    Kharif: {
        Alluvial: {
            crops: ["Tomato", "Cucumber", "Okra", "Bottle Gourd"],
            tips: ["Drip irrigation", "Support structures", "Water management"]
        },
        Black: {
            crops: ["Chillies", "Brinjal", "Bitter Gourd", "Ridge Gourd"],
            tips: ["Mulching", "Soil moisture", "Pest monitoring"]
        },
        Red: {
            crops: ["Ginger", "Turmeric", "Green Beans", "Pumpkin"],
            tips: ["Raised beds", "Organic matter", "Drainage"]
        },
        Sandy: {
            crops: ["Watermelon", "Muskmelon", "Papaya", "Peanut"],
            tips: ["Light irrigation", "Sand conditioning", "Windbreaks"]
        },
        Loamy: {
            crops: ["Carrot", "Radish", "Beet", "Lettuce"],
            tips: ["Balanced NPK", "Regular weeding", "Crop rotation"]
        },
    },
    Rabi: {
        Alluvial: {
            crops: ["Cabbage", "Cauliflower", "Broccoli", "Kale"],
            tips: ["Cool-season", "Pest control netting", "Regular watering"]
        },
        Black: {
            crops: ["Spinach", "Fenugreek", "Coriander", "Parsley"],
            tips: ["Leaf crops", "Frequent harvest", "Compost use"]
        },
        Red: {
            crops: ["Peas", "Beans", "Lentil", "Chickpea"],
            tips: ["Nitrogen fixation", "Light irrigation", "Soil enrichment"]
        },
        Sandy: {
            crops: ["Garlic", "Onion", "Shallot", "Leek"],
            tips: ["Well-draining", "Compost enriched", "Bulb crops"]
        },
        Loamy: {
            crops: ["Potato", "Sweet Potato", "Turnip", "Radish"],
            tips: ["Root crops", "Soil preparation", "Mulching"]
        },
    },
    Summer: {
        Alluvial: {
            crops: ["Basil", "Mint", "Oregano", "Thyme"],
            tips: ["Shade cloth", "Frequent misting", "Container farming"]
        },
        Black: {
            crops: ["Rosemary", "Sage", "Lavender", "Lemongrass"],
            tips: ["Aromatic herbs", "Dry conditions OK", "Minimal water"]
        },
        Red: {
            crops: ["Dill", "Fennel", "Cumin", "Fenugreek"],
            tips: ["Spice crops", "Low maintenance", "Heat tolerant"]
        },
        Sandy: {
            crops: ["Cilantro", "Parsley", "Chives", "Green Onion"],
            tips: ["Quick growing", "Regular water", "Succession planting"]
        },
        Loamy: {
            crops: ["Stevia", "Aloe Vera", "Moringa", "Drumstick"],
            tips: ["Medicinal crops", "Year-round", "High value"]
        },
    },
};

function showLargeScaleOptions() {
    document.getElementById("irrigation-page").classList.add("hidden");
    document.getElementById("large-scale-page").classList.remove("hidden");
}

function showSmallScaleOptions() {
    document.getElementById("irrigation-page").classList.add("hidden");
    document.getElementById("small-scale-page").classList.remove("hidden");
}

function showLargeScaleDetails(type) {
    const detail = largeScaleDetails[type];
    let html = `<h2 class="text-4xl font-bold mb-6">${detail.name}</h2>
                <p class="text-xl text-gray-700">${detail.description}</p>`;
    document.getElementById("large-scale-detail-content").innerHTML = html;
    largeState.irrigation = type;
    document.getElementById("large-scale-page").classList.add("hidden");
    document.getElementById("large-scale-detail-page").classList.remove("hidden");
}

function showSmallScaleDetails(type) {
    const detail = smallScaleDetails[type];
    let html = `<h2 class="text-4xl font-bold mb-6">${detail.name}</h2>
                <p class="text-xl text-gray-700">${detail.description}</p>`;
    document.getElementById("small-scale-detail-content").innerHTML = html;
    smallState.irrigation = type;
    document.getElementById("small-scale-page").classList.add("hidden");
    document.getElementById("small-scale-detail-page").classList.remove("hidden");
}

function backToLargeScaleOptions() {
    document.getElementById("large-scale-detail-page").classList.add("hidden");
    document.getElementById("large-scale-page").classList.remove("hidden");
}

function backToSmallScaleOptions() {
    document.getElementById("small-scale-detail-page").classList.add("hidden");
    document.getElementById("small-scale-page").classList.remove("hidden");
}

function proceedToLargeScaleTool() {
    currentMode = "large";
    document.getElementById("large-scale-detail-page").classList.add("hidden");
    document.getElementById("main-container-large").classList.remove("hidden");
}

function proceedToSmallScaleTool() {
    currentMode = "small";
    document.getElementById("small-scale-detail-page").classList.add("hidden");
    document.getElementById("main-container-small").classList.remove("hidden");
}

function goBackToIrrigationPage() {
    largeState = {
        season: "",
        soil: "",
        irrigation: "canal"
    };
    smallState = {
        season: "",
        soil: "",
        irrigation: ""
    };
    currentMode = "";
    document.querySelectorAll(".page").forEach(page => page.classList.add("hidden"));
    document.getElementById("irrigation-page").classList.remove("hidden");
}

function selectSeasonLarge(season) {
    largeState.season = season;
    largeState.soil = "";
    showStepLarge("step2-large");
}

function selectSoilLarge(soil) {
    largeState.soil = soil;
    showResultsLarge();
}

function goBackLarge() {
    if (!largeState.soil) {
        largeState.season = "";
        showStepLarge("step1-large");
    } else {
        largeState.soil = "";
        showStepLarge("step2-large");
    }
}

function showStepLarge(stepId) {
    document.querySelectorAll("#steps-container-large .step").forEach(step => step.classList.add("hidden"));
    document.getElementById(stepId).classList.remove("hidden");
}

function showResultsLarge() {
    const data = cropDataLarge[largeState.season][largeState.soil];
    document.getElementById("selection-summary-large").textContent = `${largeState.season} season & ${largeState.soil} soil`;
    const resultsCard = document.getElementById("results-card-large");
    const cropButtonsHtml = data.crops.map(crop => `<button onclick="openCropDetail('${crop}')" class="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-4 py-2 rounded-full text-lg font-semibold mr-2 mb-2 cursor-pointer"><span>${crop}</span></button>`).join("");
    const html = `<h3 class="text-2xl font-bold mb-4">Recommended Crops</h3><div class="mb-6">${cropButtonsHtml}</div><h3 class="text-2xl font-bold mb-3">Pro Tips</h3><ul class="text-lg text-gray-700">${data.tips.map(tip => `<li class="flex items-start">${tip}</li>`).join("")}</ul>`;
    resultsCard.innerHTML = html;
    showStepLarge("step3-large");
}

function selectSeasonSmall(season) {
    smallState.season = season;
    smallState.soil = "";
    showStepSmall("step2-small");
}

function selectSoilSmall(soil) {
    smallState.soil = soil;
    showResultsSmall();
}

function goBackSmall() {
    if (!smallState.soil) {
        smallState.season = "";
        showStepSmall("step1-small");
    } else {
        smallState.soil = "";
        showStepSmall("step2-small");
    }
}

function showStepSmall(stepId) {
    document.querySelectorAll("#steps-container-small .step").forEach(step => step.classList.add("hidden"));
    document.getElementById(stepId).classList.remove("hidden");
}

function showResultsSmall() {
    const data = cropDataSmall[smallState.season][smallState.soil];
    document.getElementById("selection-summary-small").textContent = `${smallState.season} season on ${smallState.soil} soil`;
    const resultsCard = document.getElementById("results-card-small");
    const cropButtonsHtml = data.crops.map(crop => `<button type="button" onclick="openCropDetail('${crop}')" class="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-4 py-2 rounded-full text-lg font-semibold mr-2 mb-2 cursor-pointer">${crop}</button>`).join("");
    const html = `<h3 class="text-2xl font-bold mb-4">Recommended Crops</h3><div class="mb-6">${cropButtonsHtml}</div><h3 class="text-2xl font-bold mb-3">Pro Tips</h3><ul class="space-y-2 text-lg text-gray-700">${data.tips.map(tip => `<li>${tip}</li>`).join("")}</ul>`;
    resultsCard.innerHTML = html;
    showStepSmall("step3-small");
}

function openCropDetail(cropName) {
    let crop;
    if (currentMode === "large") {
        crop = largescaleCropDetails[cropName];
    } else {
        crop = smallscaleCropDetails[cropName];
    }

    if (!crop) return;

    const irrigationList = crop.irrigation.map(il => `<li class="mb-2">${il}</li>`).join("");
    const pestList = crop.pests.map(pest => `<li class="mb-2">${pest}</li>`).join("");

    const html = `
                <div class="bg-white rounded-3xl p-8">
                    <h2 class="text-4xl font-bold mb-3 gap-3">
                        ${crop.name}
                    </h2>
                    
                    <p class="text-lg text-gray-700 mb-8 p-4 bg-emerald-100 rounded-xl">
                        ${crop.overview}
                    </p>

                    <div class="grid grid-cols-1 gap-6 mb-8">
                        <div class="bg-blue-50 p-6 rounded-xl">
                            <h3 class="text-xl font-bold mb-3">
                                Climate
                            </h3>
                            <p class="text-gray-700">${crop.climate}</p>
                        </div>

                        <div class="bg-amber-100 p-6 rounded-xl">
                            <h3 class="text-xl font-bold mb-3">
                                Soil
                            </h3>
                            <p class="text-gray-700">${crop.soil}</p>
                        </div>

                        <div class="bg-green-100 p-6 rounded-xl">
                            <h1 class="text-xl font-bold mb-3">
                                NPK
                            </h1>
                            <p class="text-gray-700">${crop.npk}</p>
                        </div>
                    </div>

                    <div class="mb-8 bg-blue-100 p-6 rounded-xl">
                        <h1 class="text-xl font-bold mb-3">
                            Irrigation
                        </h1>
                        <ul class="space-y-3 ">
                            ${irrigationList}
                        </ul>
                    </div>

                    <div class=" bg-red-100 p-6 rounded-xl">
                        <h1 class="text-xl font-bold mb-3">
                            Pest & Disease
                        </h1>
                        <ul class="space-y-3">
                            ${pestList}
                        </ul>
                    </div>
                </div>
            `;

    document.getElementById("crop-detail-full").innerHTML = html;
    if (currentMode === "large") {
        document.getElementById("main-container-large").classList.add("hidden");
    } else {
        document.getElementById("main-container-small").classList.add("hidden");
    }
    document.getElementById("detail-page").classList.remove("hidden");
}

function goBackToMainFromDetail() {
    document.getElementById("detail-page").classList.add("hidden");
    if (currentMode === "large") {
        document.getElementById("main-container-large").classList.remove("hidden");
    } else {
        document.getElementById("main-container-small").classList.remove("hidden");
    }
}
// All functions are globally accessible via regular script tag
