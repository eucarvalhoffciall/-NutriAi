(function () {
  "use strict";

  var STORAGE_KEY = "nutriai.demo.v1";
  var state = loadState();
  var pageContent = document.getElementById("page-content");
  var profileDialog = document.getElementById("profile-dialog");
  var mealDialog = document.getElementById("meal-dialog");
  var toastTimer = null;
  var viewDate = dateKey(new Date());
  var pendingPhoto = "";

  var recipes = [
    { id: "sopa", name: "Sopa de legumes", icon: "🥣", text: "Uma ideia simples para aproveitar legumes da época.", ingredients: ["cenoura", "curgete", "cebola", "batata", "azeite"] },
    { id: "aveia", name: "Taça de aveia e fruta", icon: "🍓", text: "Pequeno-almoço ou lanche com ingredientes fáceis de combinar.", ingredients: ["flocos de aveia", "leite ou bebida vegetal", "banana", "canela"] },
    { id: "grao", name: "Salada de grão", icon: "🥗", text: "Uma refeição fria para preparar com antecedência.", ingredients: ["grão-de-bico", "tomate", "pepino", "cebola roxa", "salsa"] },
    { id: "peixe", name: "Peixe no forno", icon: "🐟", text: "Peixe e legumes preparados numa só travessa.", ingredients: ["peixe", "batata", "brócolos", "limão", "azeite"] },
    { id: "omelete", name: "Omelete de espinafres", icon: "🍳", text: "Uma opção rápida que podes adaptar ao que tens em casa.", ingredients: ["ovos", "espinafres", "cebola", "queijo"] },
    { id: "iogurte", name: "Iogurte com fruta", icon: "🫐", text: "Combina iogurte, fruta e uma cobertura à tua escolha.", ingredients: ["iogurte natural", "fruta", "sementes", "frutos secos"] }
  ];

  function loadState() {
    var initial = { profile: null, meals: [], water: [], activities: [], weights: [], fast: null, fastHistory: [], shopping: [], dark: false };
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved || typeof saved !== "object") return initial;
      Object.keys(initial).forEach(function (key) {
        if (typeof saved[key] !== "undefined") initial[key] = saved[key];
      });
    } catch (error) {
      return initial;
    }
    if (!Array.isArray(initial.meals)) initial.meals = [];
    if (!Array.isArray(initial.water)) initial.water = [];
    if (!Array.isArray(initial.activities)) initial.activities = [];
    if (!Array.isArray(initial.weights)) initial.weights = [];
    if (!Array.isArray(initial.fastHistory)) initial.fastHistory = [];
    if (!Array.isArray(initial.shopping)) initial.shopping = [];
    return initial;
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      showToast("O navegador ficou sem espaço. Exporta os teus dados ou remove algumas fotografias.");
      return false;
    }
  }

  function dateKey(date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function parseDate(key) {
    var parts = String(key || "").split("-").map(Number);
    return new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
  }

  function formatDate(key, options) {
    return parseDate(key).toLocaleDateString("pt-PT", options || { day: "numeric", month: "long", year: "numeric" });
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function number(value) {
    var result = Number(value);
    return Number.isFinite(result) ? result : 0;
  }

  function whole(value) {
    return Math.round(number(value)).toLocaleString("pt-PT");
  }

  function decimal(value) {
    return number(value).toLocaleString("pt-PT", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  }

  function clampPercent(value, goal) {
    if (!number(goal)) return 0;
    return Math.max(0, Math.min(100, Math.round(number(value) / number(goal) * 100)));
  }

  function getMeals(key) {
    return state.meals.filter(function (meal) { return meal.date === key; }).sort(function (a, b) {
      return String(a.time || "").localeCompare(String(b.time || ""));
    });
  }

  function totalsForMeals(meals) {
    return meals.reduce(function (totals, meal) {
      totals.calories += number(meal.calories);
      totals.protein += number(meal.protein);
      totals.carbs += number(meal.carbs);
      totals.fat += number(meal.fat);
      return totals;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
  }

  function getWater(key) {
    return state.water.filter(function (entry) { return entry.date === key; }).reduce(function (sum, item) { return sum + number(item.amount); }, 0);
  }

  function getActivities(key) {
    return state.activities.filter(function (entry) { return entry.date === key; });
  }

  function showToast(message) {
    var toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("show"); }, 3000);
  }

  function setPage(page) {
    var valid = ["home", "meals", "progress", "habits", "recipes", "settings"];
    state.currentPage = valid.indexOf(page) >= 0 ? page : "home";
    document.querySelectorAll("[data-page]").forEach(function (button) {
      var active = button.getAttribute("data-page") === state.currentPage;
      button.classList.toggle("active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    renderPage();
  }

  function pageHeading(kicker, title, description, actions) {
    return "<div class='page-heading'><div><div class='eyebrow'>" + esc(kicker) + "</div><h1>" + esc(title) + "</h1><p>" + esc(description) + "</p></div>" + (actions || "") + "</div>";
  }

  function cardHeader(title, subtitle, action) {
    return "<div class='card-header'><div><h2 class='card-title'>" + esc(title) + "</h2>" + (subtitle ? "<p class='card-subtitle'>" + esc(subtitle) + "</p>" : "") + "</div>" + (action || "") + "</div>";
  }

  function progressBar(value, goal, color) {
    var className = color ? "progress-track " + color : "progress-track";
    return "<div class='" + className + "' aria-label='" + clampPercent(value, goal) + "%'><span style='width:" + clampPercent(value, goal) + "%'></span></div>";
  }

  function mealIcon(category) {
    var icons = { "Pequeno-almoço": "☀", "Almoço": "◒", "Lanche": "◌", "Jantar": "☾", "Outro": "✦" };
    return icons[category] || "◉";
  }

  function mealRow(meal, removable) {
    var safeImage = typeof meal.photoData === "string" && meal.photoData.indexOf("data:image/") === 0;
    var icon = safeImage ? "<img class='meal-thumb' alt='' src='" + meal.photoData + "'>" : esc(mealIcon(meal.category));
    return "<div class='meal-row'><div class='meal-icon'>" + icon + "</div><div class='meal-name'><strong>" + esc(meal.title) + "</strong><span>" + esc(meal.category || "Refeição") + (meal.portion ? " · " + esc(meal.portion) : "") + (meal.time ? " · " + esc(meal.time) : "") + "</span></div><div class='meal-kcal'>" + whole(meal.calories) + " kcal" + (removable ? "<button class='icon-action' type='button' data-action='delete-meal' data-id='" + esc(meal.id) + "' aria-label='Apagar registo'>×</button>" : "") + "</div></div>";
  }

  function dateActions() {
    return "<div class='date-switch'><button type='button' data-action='prev-day' aria-label='Dia anterior'>‹</button><strong>" + esc(formatDate(viewDate, { day: "numeric", month: "short" })) + "</strong><button type='button' data-action='next-day' aria-label='Dia seguinte'>›</button></div>";
  }

  function renderHome() {
    var profile = state.profile || {};
    var meals = getMeals(viewDate);
    var totals = totalsForMeals(meals);
    var goal = number(profile.calorieGoal);
    var remaining = Math.max(0, goal - totals.calories);
    var water = getWater(viewDate);
    var waterGoal = number(profile.waterGoal) || 2000;
    var activities = getActivities(viewDate);
    var minutes = activities.reduce(function (sum, item) { return sum + number(item.minutes); }, 0);
    var streak = getStreak();
    var name = String(profile.name || "amigo").split(" ")[0];
    var macroCards = [
      { label: "Proteína", value: totals.protein, goal: profile.proteinGoal, color: "" },
      { label: "Hidratos", value: totals.carbs, goal: profile.carbsGoal, color: "gold" },
      { label: "Gordura", value: totals.fat, goal: profile.fatGoal, color: "purple" }
    ];
    var macroHtml = macroCards.map(function (item) {
      return "<div class='macro-card'><div class='macro-card-top'><span class='macro-dot'></span><span class='macro-card-label'>" + item.label + "</span></div><strong>" + decimal(item.value) + "<small> g" + (number(item.goal) ? " / " + decimal(item.goal) : "") + "</small></strong>" + progressBar(item.value, item.goal || 0, item.color) + "</div>";
    }).join("");
    var mealsHtml = meals.length ? meals.map(function (meal) { return mealRow(meal, false); }).join("") : "<div class='empty-state'><div class='empty-icon'>◉</div>Ainda não há refeições neste dia.<br>Regista a primeira para começares o teu diário.</div>";
    var suggestionText = goal ? "A meta de " + whole(goal) + " kcal foi introduzida no teu perfil. O diário soma os valores que registares; não calcula um plano alimentar." : "Define a tua meta diária no perfil, de acordo com as tuas necessidades e orientação profissional.";

    return "<div class='page-heading'><div><div class='eyebrow'>O teu espaço</div><h1>Olá, " + esc(name) + ".</h1><p>Um resumo do que registaste, sem complicar.</p></div><div class='heading-actions'>" + dateActions() + "<button class='button' type='button' data-action='add-meal'>＋ Registar refeição</button></div></div>" +
      "<div class='dashboard-grid'><div class='stack'>" +
      "<section class='card hero-card'><div class='hero-card-head'><div><div class='eyebrow'>NutriAI · diário pessoal</div><h1>O teu dia, à tua maneira.</h1><p>Pequenos registos ajudam-te a ver o que já anotaste.</p></div><span class='date-badge'>" + esc(formatDate(viewDate, { weekday: "long", day: "numeric", month: "long" })) + "</span></div></section>" +
      "<section class='card'>" + cardHeader("Energia registada", "Soma das refeições que adicionaste", "") +
      "<div class='calorie-card'><div><div class='calorie-ring' style='--progress:" + clampPercent(totals.calories, goal || 1) + "%'><div class='ring-content'><strong>" + whole(totals.calories) + "</strong><small>kcal registadas</small></div></div><div class='ring-remaining'>" + (goal ? whole(remaining) + " kcal até à meta definida" : "Define a tua meta no perfil") + "</div></div>" +
      "<div class='calorie-details'><div class='detail-row'><span>Meta diária definida</span><strong>" + (goal ? whole(goal) + " kcal" : "—") + "</strong></div>" + progressBar(totals.calories, goal || 1) + "<div class='detail-row'><span>Refeições registadas</span><strong>" + meals.length + "</strong></div><div class='detail-row'><span>Atividade registada</span><strong>" + minutes + " min</strong></div></div></div></section>" +
      "<section class='card'>" + cardHeader("Macronutrientes", "Valores inseridos nos teus registos", "") + "<div class='macro-grid'>" + macroHtml + "</div></section>" +
      "<section class='card'>" + cardHeader("O teu diário", "Refeições de " + formatDate(viewDate, { day: "numeric", month: "long" }), "<button class='text-link' type='button' data-page='meals'>Ver diário →</button>") + mealsHtml + "</section>" +
      "</div><div class='stack'>" +
      "<section class='card'>" + cardHeader("Hidratação", "Registos de hoje", "<div class='water-glass' style='--water-fill:" + clampPercent(water, waterGoal) + "%'><span>" + clampPercent(water, waterGoal) + "%</span></div>") +
      "<div class='side-stat'><div><strong>" + whole(water) + " <span>ml</span></strong><span>Meta definida: " + whole(waterGoal) + " ml</span></div></div><div class='habit-actions'><button class='button small' type='button' data-action='add-water' data-amount='250'>＋ 250 ml</button><button class='button secondary small' type='button' data-action='add-water' data-amount='500'>＋ 500 ml</button></div></section>" +
      "<section class='card streak-card'>" + cardHeader("Dias com registos", "", "<div class='streak-icon'>✦</div>") + "<div class='side-stat'><strong>" + streak + " <span>" + (streak === 1 ? "dia" : "dias") + "</span></strong><span>Sequência atual de dias com refeições registadas</span></div></section>" +
      "<section class='card'>" + cardHeader("Jejum", "Temporizador e histórico", "") + (state.fast ? "<div class='fast-clock' data-fast-clock>--:--:--</div><p class='card-subtitle'>Objetivo: " + decimal(state.fast.targetHours) + " h · iniciado " + esc(new Date(state.fast.startedAt).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })) + "</p><div class='habit-actions'><button class='button secondary small' type='button' data-page='habits'>Abrir temporizador →</button></div>" : "<div class='empty-state'>Ainda não tens um temporizador ativo.</div><div class='habit-actions'><button class='button secondary small' type='button' data-page='habits'>Ver hábitos →</button></div>") + "</section>" +
      "<section class='card suggestion'>" + cardHeader("Resumo das metas", "Informação do teu perfil", "") + "<p>" + esc(suggestionText) + "</p></section>" +
      "</div></div>";
  }

  function renderMeals() {
    var meals = getMeals(viewDate);
    var totals = totalsForMeals(meals);
    var list = meals.length ? "<div class='table-list'>" + meals.map(function (meal) { return mealRow(meal, true); }).join("") + "</div>" : "<div class='empty-state'><div class='empty-icon'>◉</div>Este dia ainda não tem refeições.<br><button class='button small' type='button' data-action='add-meal' style='margin-top:12px'>＋ Registar primeira refeição</button></div>";
    return pageHeading("Diário alimentar", "As tuas refeições.", "Regista o que comeste e acompanha a soma dos valores que introduziste.", "<div class='heading-actions'>" + dateActions() + "<button class='button' type='button' data-action='add-meal'>＋ Registar refeição</button></div>") +
      "<div class='stats-row'><div class='stat-box'><span>Energia registada</span><strong>" + whole(totals.calories) + " kcal</strong><small>Meta: " + (state.profile.calorieGoal ? whole(state.profile.calorieGoal) + " kcal" : "por definir") + "</small></div><div class='stat-box'><span>Refeições</span><strong>" + meals.length + "</strong><small>neste dia</small></div><div class='stat-box'><span>Proteína registada</span><strong>" + decimal(totals.protein) + " g</strong><small>valor informado por ti</small></div></div>" +
      "<section class='card'>" + cardHeader("Registos de " + formatDate(viewDate, { day: "numeric", month: "long" }), "Os valores são guardados neste navegador.", "") + list + "</section>" +
      "<p class='help-copy'>A fotografia pode ser anexada ao registo. Nesta demonstração, os alimentos e valores nutricionais são inseridos manualmente e não são identificados por IA.</p>";
  }

  function renderProgress() {
    var sorted = state.weights.slice().sort(function (a, b) { return a.date.localeCompare(b.date); }).slice(-12);
    var currentWeight = sorted.length ? sorted[sorted.length - 1].weight : number(state.profile.weight);
    var firstWeight = sorted.length ? sorted[0].weight : number(state.profile.weight);
    var delta = currentWeight - firstWeight;
    var history = sorted.slice().reverse();
    var weightRows = history.length ? "<div class='table-list'>" + history.slice(0, 6).map(function (entry) {
      return "<div class='table-row'><div><strong>" + esc(formatDate(entry.date, { day: "numeric", month: "short", year: "numeric" })) + "</strong><small>Peso registado</small></div><span class='tag'>" + decimal(entry.weight) + " kg</span><button class='icon-action' type='button' data-action='delete-weight' data-id='" + esc(entry.id) + "' aria-label='Apagar registo'>×</button></div>";
    }).join("") + "</div>" : "<div class='empty-state'>Adiciona o primeiro registo de peso para começares o gráfico.</div>";
    var recentMeals = state.meals.filter(function (meal) { return meal.date >= dateKey(new Date(Date.now() - 6 * 86400000)); });
    var weekly = totalsForMeals(recentMeals);
    return pageHeading("Evolução", "O teu progresso.", "Consulta os registos de peso e alimentação que adicionaste.", "") +
      "<div class='stats-row'><div class='stat-box'><span>Peso mais recente</span><strong>" + decimal(currentWeight) + " kg</strong><small>registo manual</small></div><div class='stat-box'><span>Variação no gráfico</span><strong>" + (delta > 0 ? "+" : "") + decimal(delta) + " kg</strong><small>entre o primeiro e o último ponto</small></div><div class='stat-box'><span>Energia registada · 7 dias</span><strong>" + whole(weekly.calories) + " kcal</strong><small>soma dos teus registos</small></div></div>" +
      "<div class='content-grid'><section class='card'>" + cardHeader("Peso ao longo do tempo", "Até aos últimos 12 registos", "") + "<canvas id='weight-chart' class='weight-chart' role='img' aria-label='Gráfico dos registos de peso'></canvas><div class='chart-note'><span class='chart-dot'></span> Peso registado manualmente · não representa uma previsão</div></section>" +
      "<section class='card'>" + cardHeader("Adicionar peso", "Regista uma medição quando quiseres", "") + "<form class='inline-form' data-form='weight'><label class='field'>Data<input name='date' type='date' value='" + dateKey(new Date()) + "' required></label><label class='field'>Peso (kg)<input name='weight' type='number' min='25' max='350' step='0.1' inputmode='decimal' placeholder='Ex.: 72,5' required></label><button class='button' type='submit'>Guardar peso</button></form><div style='height:16px'></div>" + cardHeader("Registos recentes", "", "") + weightRows + "</section></div>" +
      "<p class='help-copy'>As variações de peso podem ter várias causas e não devem ser interpretadas isoladamente. Para orientação individual, fala com um profissional de saúde.</p>";
  }

  function renderHabits() {
    var today = dateKey(new Date());
    var water = getWater(today);
    var waterGoal = number(state.profile.waterGoal) || 2000;
    var activities = getActivities(today);
    var exerciseMinutes = activities.reduce(function (sum, item) { return sum + number(item.minutes); }, 0);
    var activityRows = activities.length ? "<div class='table-list'>" + activities.map(function (item) {
      return "<div class='table-row'><div><strong>" + esc(item.name) + "</strong><small>" + item.minutes + " min · " + esc(formatDate(item.date, { day: "numeric", month: "short" })) + "</small></div><span class='tag'>" + (item.calories ? whole(item.calories) + " kcal" : "Atividade") + "</span><button class='icon-action' type='button' data-action='delete-activity' data-id='" + esc(item.id) + "' aria-label='Apagar atividade'>×</button></div>";
    }).join("") + "</div>" : "<div class='empty-state'>Ainda não há atividade registada.</div>";
    var fastBody = state.fast ?
      "<div class='fast-box'><div><div class='eyebrow'>Temporizador ativo</div><h3>O teu período de jejum</h3><p class='card-subtitle' style='color:#c1dfcf'>Objetivo: " + decimal(state.fast.targetHours) + " horas</p></div><div><div class='fast-clock' data-fast-clock>--:--:--</div><button class='button small' type='button' data-action='stop-fast'>Terminar registo</button></div></div>" :
      "<div class='fast-box'><div><div class='eyebrow'>Registo opcional</div><h3>Iniciar temporizador</h3><p class='card-subtitle' style='color:#c1dfcf'>Escolhe um período para acompanhar.</p></div><div><select id='fast-hours' aria-label='Duração pretendida' style='height:38px;border-radius:10px;padding:0 9px'><option value='12'>12 horas</option><option value='14'>14 horas</option><option value='16'>16 horas</option><option value='18'>18 horas</option></select><button class='button small' type='button' data-action='start-fast' style='margin-top:7px'>Começar</button></div></div>";
    var fastHistory = state.fastHistory.length ? "<div class='table-list'>" + state.fastHistory.slice().reverse().slice(0, 5).map(function (entry) {
      return "<div class='table-row'><div><strong>" + esc(formatDate(entry.date, { day: "numeric", month: "short" })) + "</strong><small>" + (entry.completed ? "Objetivo alcançado" : "Registo terminado") + "</small></div><span class='tag'>" + decimal(entry.duration) + " h</span><span></span></div>";
    }).join("") + "</div>" : "<div class='empty-state'>Os registos concluídos vão aparecer aqui.</div>";
    return pageHeading("Rotina", "Acompanha os teus hábitos.", "Regista água, atividade e períodos de jejum se fizerem parte da tua rotina.", "") +
      "<div class='habit-grid'><section class='card'>" + cardHeader("Água", "Registos de hoje", "") + "<div class='water-visual'><div class='water-large' style='--water-fill:" + clampPercent(water, waterGoal) + "%'><span>" + clampPercent(water, waterGoal) + "%</span></div><div><div class='habit-number'>" + whole(water) + " <span style='font-size:13px;color:var(--muted);font-weight:500'>ml</span></div><div class='card-subtitle'>Meta definida no perfil: " + whole(waterGoal) + " ml</div></div></div><div style='margin-top:15px'>" + progressBar(water, waterGoal) + "</div><div class='habit-actions'><button class='button small' type='button' data-action='add-water' data-amount='250'>＋ 250 ml</button><button class='button secondary small' type='button' data-action='add-water' data-amount='500'>＋ 500 ml</button><button class='button secondary small' type='button' data-action='custom-water'>Outra quantidade</button></div></section>" +
      "<section class='card'>" + cardHeader("Atividade", "Regista o que fizeste", "") + "<div class='side-stat' style='margin-bottom:14px'><strong>" + exerciseMinutes + " <span>min</span></strong><span>de atividade registada hoje</span></div><form class='inline-form' data-form='activity'><label class='field'>Atividade<input name='name' maxlength='60' required placeholder='Ex.: caminhada'></label><label class='field'>Minutos<input name='minutes' type='number' min='1' max='1440' required inputmode='numeric' placeholder='30'></label><label class='field'>Energia (opcional)<input name='calories' type='number' min='0' max='5000' inputmode='numeric' placeholder='kcal'></label><button class='button' type='submit'>Guardar atividade</button></form><div style='height:12px'></div>" + activityRows + "</section>" +
      "<section class='card' style='grid-column:1/-1'>" + cardHeader("Jejum", "Temporizador e histórico pessoal", "") + fastBody + "<div style='height:16px'></div>" + cardHeader("Registos anteriores", "", "") + fastHistory + "<p class='help-copy'>O temporizador apenas mede o tempo. Não recomenda períodos de jejum. O jejum pode não ser adequado a toda a gente; procura aconselhamento de um profissional de saúde.</p></section></div>";
  }

  function renderRecipes() {
    var recipeCards = recipes.map(function (recipe) {
      return "<article class='recipe-card'><div class='recipe-visual' aria-hidden='true'>" + recipe.icon + "</div><h3>" + esc(recipe.name) + "</h3><p>" + esc(recipe.text) + "</p><div class='ingredient-list'>" + recipe.ingredients.map(function (ingredient) { return "<span>" + esc(ingredient) + "</span>"; }).join("") + "</div><button class='button secondary small' type='button' data-action='add-recipe' data-recipe='" + esc(recipe.id) + "'>Adicionar ingredientes</button></article>";
    }).join("");
    var shoppingRows = state.shopping.length ? state.shopping.map(function (item) {
      return "<div class='shopping-item " + (item.checked ? "checked" : "") + "'><input type='checkbox' data-action='toggle-shopping' data-id='" + esc(item.id) + "' " + (item.checked ? "checked" : "") + " aria-label='Marcar " + esc(item.name) + " como comprado'><label>" + esc(item.name) + "</label><button class='icon-action' type='button' data-action='delete-shopping' data-id='" + esc(item.id) + "' aria-label='Remover da lista'>×</button></div>";
    }).join("") : "<div class='empty-state'>A tua lista está vazia.<br>Adiciona ingredientes das ideias de receitas.</div>";
    return pageHeading("Organização", "Receitas e lista de compras.", "Ideias simples e ingredientes para organizares a tua semana.", "") +
      "<div class='recipe-columns'><section><div class='card' style='margin-bottom:15px'>" + cardHeader("Ideias para a tua mesa", "Sugestões gerais. Adapta ingredientes às tuas preferências.", "") + "<div class='recipe-grid'>" + recipeCards + "</div></div><p class='help-copy'>As receitas são ideias de preparação e não incluem valores nutricionais calculados nesta versão.</p></section>" +
      "<section class='card'>" + cardHeader("Lista de compras", "Guardada neste navegador", "<button class='text-link' type='button' data-action='clear-shopping'>Limpar</button>") + "<form class='inline-form' data-form='shopping'><label class='field' style='flex:1'>Novo ingrediente<input name='name' maxlength='80' required placeholder='Ex.: tomates'></label><button class='button' type='submit'>Adicionar</button></form><div style='height:10px'></div>" + shoppingRows + "</section></div>";
  }

  function option(value, label, current) {
    return "<option value='" + esc(value) + "'" + (String(current || "") === value ? " selected" : "") + ">" + esc(label) + "</option>";
  }

  function renderSettings() {
    var profile = state.profile || {};
    var sexOptions = option("", "Prefiro não indicar", profile.sex) + option("feminino", "Feminino", profile.sex) + option("masculino", "Masculino", profile.sex);
    var activityOptions = option("", "Prefiro não indicar", profile.activityLevel) + option("baixo", "Pouco ativo", profile.activityLevel) + option("leve", "Atividade leve", profile.activityLevel) + option("moderado", "Atividade moderada", profile.activityLevel) + option("alto", "Muito ativo", profile.activityLevel);
    var goalOptions = option("", "Escolher mais tarde", profile.goal) + option("perder", "Perder peso", profile.goal) + option("manter", "Manter o peso", profile.goal) + option("ganhar", "Aumentar o peso", profile.goal) + option("habitos", "Acompanhar hábitos", profile.goal);
    return pageHeading("Personalização", "Perfil e metas.", "Atualiza os dados que usas para organizar os teus registos.", "") +
      "<section class='card settings-panel'>" + cardHeader("Os teus dados", "Guardados localmente neste navegador", "") +
      "<form class='form-grid' data-form='profile'>" +
      "<label class='field span-2'>Nome<input name='name' maxlength='60' required value='" + esc(profile.name) + "'></label>" +
      "<label class='field'>Idade<input name='age' type='number' min='16' max='110' value='" + esc(profile.age || "") + "'></label>" +
      "<label class='field'>Altura (cm)<input name='height' type='number' min='100' max='230' value='" + esc(profile.height || "") + "'></label>" +
      "<label class='field'>Sexo para estimativas futuras<select name='sex'>" + sexOptions + "</select></label>" +
      "<label class='field'>Nível de atividade<select name='activityLevel'>" + activityOptions + "</select></label>" +
      "<label class='field span-2'>Objetivo pessoal<select name='goal'>" + goalOptions + "</select></label>" +
      "<label class='field'>Peso atual (kg)<input name='weight' type='number' min='25' max='350' step='0.1' required value='" + esc(profile.weight || "") + "'></label>" +
      "<label class='field'>Peso que pretendes acompanhar (kg)<input name='targetWeight' type='number' min='25' max='350' step='0.1' value='" + esc(profile.targetWeight || "") + "'></label>" +
      "<label class='field'>Meta diária de energia (kcal)<input name='calorieGoal' type='number' min='500' max='8000' required value='" + esc(profile.calorieGoal || "") + "'></label>" +
      "<label class='field'>Meta de água (ml)<input name='waterGoal' type='number' min='250' max='8000' step='250' required value='" + esc(profile.waterGoal || 2000) + "'></label>" +
      "<label class='field'>Proteína (g)<input name='proteinGoal' type='number' min='0' max='1000' value='" + esc(profile.proteinGoal || 0) + "'></label>" +
      "<label class='field'>Hidratos de carbono (g)<input name='carbsGoal' type='number' min='0' max='1500' value='" + esc(profile.carbsGoal || 0) + "'></label>" +
      "<label class='field'>Gordura (g)<input name='fatGoal' type='number' min='0' max='1000' value='" + esc(profile.fatGoal || 0) + "'></label>" +
      "<div class='span-2'><button class='button' type='submit'>Guardar alterações</button></div></form>" +
      "<div class='privacy-callout'><span>◆</span><p>Sexo, atividade e objetivo ficam no perfil, mas ainda não são usados para calcular metas nesta demonstração. A NutriAI não calcula necessidades clínicas nem substitui aconselhamento profissional.</p></div></section>" +
      "<section class='card' style='margin-top:15px'>" + cardHeader("Os teus dados", "Exporta uma cópia ou apaga o conteúdo local", "") + "<p class='help-copy'>A demonstração não tem conta online, palavras-passe ou sincronização na nuvem. Ao limpar os dados do navegador, os registos podem desaparecer.</p><div class='habit-actions'><button class='button secondary' type='button' data-action='export'>Exportar os meus dados</button><button class='button secondary' type='button' data-action='clear-data' style='color:#a34444'>Apagar registos deste dispositivo</button></div></section>";
  }

  function renderPage() {
    document.body.classList.toggle("dark", !!state.dark);
    var profile = state.profile || {};
    document.getElementById("user-name-top").textContent = profile.name || "Perfil";
    document.getElementById("avatar-letter").textContent = profile.name ? profile.name.trim().charAt(0).toUpperCase() : "N";
    var page = state.currentPage || "home";
    var renderers = { home: renderHome, meals: renderMeals, progress: renderProgress, habits: renderHabits, recipes: renderRecipes, settings: renderSettings };
    pageContent.innerHTML = (renderers[page] || renderHome)();
    if (page === "progress") drawWeightChart();
    updateFastClock();
  }

  function getStreak() {
    var dates = {};
    state.meals.forEach(function (meal) { dates[meal.date] = true; });
    var count = 0;
    var cursor = new Date();
    if (!dates[dateKey(cursor)]) cursor.setDate(cursor.getDate() - 1);
    while (dates[dateKey(cursor)] && count < 365) {
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  }

  function drawWeightChart() {
    var canvas = document.getElementById("weight-chart");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    var width = canvas.clientWidth || 500;
    var height = canvas.clientHeight || 230;
    var ratio = window.devicePixelRatio || 1;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.scale(ratio, ratio);
    var entries = state.weights.slice().sort(function (a, b) { return a.date.localeCompare(b.date); }).slice(-12);
    if (!entries.length && state.profile && state.profile.weight) entries = [{ date: dateKey(new Date()), weight: number(state.profile.weight) }];
    var dark = document.body.classList.contains("dark");
    var grid = dark ? "#2b3a31" : "#e9efea";
    var text = dark ? "#9eafa5" : "#84938b";
    var accent = dark ? "#8bd5a8" : "#167a58";
    ctx.clearRect(0, 0, width, height);
    ctx.font = "10px DM Sans, sans-serif";
    ctx.fillStyle = text;
    if (!entries.length) {
      ctx.textAlign = "center";
      ctx.fillText("Sem registos de peso", width / 2, height / 2);
      return;
    }
    var values = entries.map(function (item) { return number(item.weight); });
    var min = Math.min.apply(null, values);
    var max = Math.max.apply(null, values);
    var padding = { top: 18, right: 16, bottom: 31, left: 38 };
    var chartW = width - padding.left - padding.right;
    var chartH = height - padding.top - padding.bottom;
    var spread = Math.max(1, max - min);
    min -= spread * .2;
    max += spread * .2;
    for (var i = 0; i < 4; i++) {
      var y = padding.top + chartH * i / 3;
      ctx.strokeStyle = grid;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      ctx.textAlign = "right";
      ctx.fillStyle = text;
      ctx.fillText(decimal(max - (max - min) * i / 3), padding.left - 7, y + 3);
    }
    var points = entries.map(function (entry, index) {
      return { x: entries.length === 1 ? padding.left + chartW / 2 : padding.left + chartW * index / (entries.length - 1), y: padding.top + chartH * (max - number(entry.weight)) / (max - min), entry: entry };
    });
    ctx.beginPath();
    points.forEach(function (point, index) { if (!index) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y); });
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.stroke();
    points.forEach(function (point, index) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.fill();
      ctx.fillStyle = text;
      ctx.textAlign = index === 0 ? "left" : index === points.length - 1 ? "right" : "center";
      ctx.fillText(parseDate(point.entry.date).toLocaleDateString("pt-PT", { day: "numeric", month: "short" }), point.x, height - 8);
    });
  }

  function fillProfileForm() {
    var form = document.getElementById("profile-form");
    var profile = state.profile || {};
    ["name", "age", "height", "sex", "activityLevel", "goal", "weight", "targetWeight", "calorieGoal", "waterGoal", "proteinGoal", "carbsGoal", "fatGoal"].forEach(function (field) {
      if (form.elements[field]) form.elements[field].value = profile[field] == null ? (field === "waterGoal" ? 2000 : field.indexOf("Goal") >= 0 && field !== "calorieGoal" ? 0 : "") : profile[field];
    });
    document.getElementById("profile-title").textContent = state.profile ? "Atualiza o teu perfil." : "Vamos preparar o teu perfil.";
  }

  function openProfileDialog() {
    fillProfileForm();
    if (!profileDialog.open) profileDialog.showModal();
  }

  function openMealDialog() {
    var form = document.getElementById("meal-form");
    form.reset();
    form.elements.date.value = viewDate;
    form.elements.photoData.value = "";
    pendingPhoto = "";
    document.getElementById("photo-preview").hidden = true;
    document.getElementById("photo-label").textContent = "Tirar ou escolher uma fotografia";
    if (!mealDialog.open) mealDialog.showModal();
  }

  function closeDialog(dialog) {
    if (dialog && dialog.open) dialog.close();
  }

  function handleProfileSubmit(event) {
    event.preventDefault();
    var form = event.currentTarget;
    var data = new FormData(form);
    var oldWeight = state.profile ? number(state.profile.weight) : 0;
    state.profile = {
      name: String(data.get("name") || "").trim(),
      age: number(data.get("age")) || "",
      height: number(data.get("height")) || "",
      sex: String(data.get("sex") || ""),
      activityLevel: String(data.get("activityLevel") || ""),
      goal: String(data.get("goal") || ""),
      weight: number(data.get("weight")),
      targetWeight: number(data.get("targetWeight")) || "",
      calorieGoal: number(data.get("calorieGoal")),
      waterGoal: number(data.get("waterGoal")) || 2000,
      proteinGoal: number(data.get("proteinGoal")),
      carbsGoal: number(data.get("carbsGoal")),
      fatGoal: number(data.get("fatGoal"))
    };
    if (!state.weights.length || oldWeight !== state.profile.weight) {
      state.weights.push({ id: makeId(), date: dateKey(new Date()), weight: state.profile.weight });
    }
    saveState();
    closeDialog(profileDialog);
    renderPage();
    showToast("Perfil guardado neste dispositivo.");
  }

  function handleMealSubmit(event) {
    event.preventDefault();
    var form = event.currentTarget;
    var data = new FormData(form);
    var calories = number(data.get("calories"));
    if (!String(data.get("title") || "").trim() || calories < 0) {
      showToast("Confirma a descrição e as calorias.");
      return;
    }
    var meal = {
      id: makeId(),
      title: String(data.get("title") || "").trim(),
      category: String(data.get("category") || "Outro"),
      date: String(data.get("date") || dateKey(new Date())),
      time: new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }),
      portion: String(data.get("portion") || "").trim(),
      calories: calories,
      protein: number(data.get("protein")),
      carbs: number(data.get("carbs")),
      fat: number(data.get("fat")),
      photoData: String(data.get("photoData") || "")
    };
    state.meals.push(meal);
    saveState();
    viewDate = meal.date;
    closeDialog(mealDialog);
    renderPage();
    showToast("Refeição guardada no diário.");
  }

  function makeId() {
    return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + "-" + Math.random().toString(16).slice(2);
  }

  function compressImage(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error("Não foi possível abrir a imagem.")); };
      reader.onload = function () {
        var image = new Image();
        image.onerror = function () { reject(new Error("Formato de imagem não suportado.")); };
        image.onload = function () {
          var maxSide = 900;
          var scale = Math.min(1, maxSide / Math.max(image.width, image.height));
          var canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
          var quality = .72;
          var result = canvas.toDataURL("image/jpeg", quality);
          while (result.length > 520000 && quality > .38) {
            quality -= .08;
            result = canvas.toDataURL("image/jpeg", quality);
          }
          resolve(result);
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function handlePhotoChange(event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type || file.type.indexOf("image/") !== 0) {
      showToast("Escolhe um ficheiro de imagem.");
      return;
    }
    compressImage(file).then(function (dataUrl) {
      pendingPhoto = dataUrl;
      document.querySelector("#meal-form [name='photoData']").value = dataUrl;
      var preview = document.getElementById("photo-preview");
      preview.src = dataUrl;
      preview.hidden = false;
      document.getElementById("photo-label").textContent = "Fotografia anexada ao registo";
      showToast("A fotografia fica guardada apenas neste navegador.");
    }).catch(function () {
      showToast("Não foi possível preparar essa fotografia.");
    });
  }

  function lookupBarcode() {
    var input = document.getElementById("barcode-input");
    var button = document.getElementById("lookup-barcode");
    var code = String(input.value || "").replace(/\s+/g, "");
    if (!/^\d{8,14}$/.test(code)) {
      showToast("Confirma o código de barras, entre 8 e 14 algarismos.");
      input.focus();
      return;
    }
    button.disabled = true;
    button.textContent = "A consultar…";
    var endpoint = "https://world.openfoodfacts.org/api/v3/product/" + encodeURIComponent(code) + "?fields=product_name,product_name_pt,product_quantity,nutriments&cc=pt&lc=pt";
    fetch(endpoint, { headers: { Accept: "application/json" } }).then(function (response) {
      if (!response.ok) throw new Error("network");
      return response.json();
    }).then(function (result) {
      var product = result && result.product;
      if (!product || result.status === 0 || result.status === "failure") throw new Error("not-found");
      var nutrients = product.nutriments || {};
      var kcal = number(nutrients["energy-kcal_100g"] || nutrients["energy-kcal_value"]);
      if (!kcal && number(nutrients["energy_100g"])) kcal = number(nutrients["energy_100g"]) / 4.184;
      var protein = number(nutrients.proteins_100g);
      var carbs = number(nutrients.carbohydrates_100g);
      var fat = number(nutrients.fat_100g);
      if (!kcal && !protein && !carbs && !fat) throw new Error("no-nutrition");
      var name = product.product_name_pt || product.product_name || "Produto " + code;
      document.getElementById("meal-description").value = name;
      document.querySelector("#meal-form [name='portion']").value = "100 g";
      document.querySelector("#meal-form [name='calories']").value = Math.round(kcal);
      document.querySelector("#meal-form [name='protein']").value = decimal(protein).replace(",", ".");
      document.querySelector("#meal-form [name='carbs']").value = decimal(carbs).replace(",", ".");
      document.querySelector("#meal-form [name='fat']").value = decimal(fat).replace(",", ".");
      showToast("Produto encontrado. Confirma os valores no rótulo antes de guardar.");
    }).catch(function (error) {
      if (error.message === "not-found") showToast("Produto não encontrado na base. Podes preencher os valores manualmente.");
      else if (error.message === "no-nutrition") showToast("Este produto não tem valores nutricionais suficientes. Preenche-os manualmente.");
      else showToast("Não foi possível consultar a base agora. Tenta novamente ou preenche manualmente.");
    }).finally(function () {
      button.disabled = false;
      button.textContent = "Consultar produto";
    });
  }

  function startDictation() {
    var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast("O teu navegador não disponibiliza ditado por voz. Escreve a descrição.");
      return;
    }
    var recognition = new SpeechRecognition();
    recognition.lang = "pt-PT";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = function () { showToast("Ditado iniciado. Fala agora."); };
    recognition.onerror = function () { showToast("Não foi possível usar o microfone. Verifica a permissão do navegador."); };
    recognition.onresult = function (event) {
      var transcript = event.results && event.results[0] && event.results[0][0] ? event.results[0][0].transcript : "";
      var input = document.getElementById("meal-description");
      if (input && transcript) input.value = transcript;
      showToast("Transcrição preenchida. O áudio não é guardado pela NutriAI.");
    };
    recognition.start();
  }

  function handleFormSubmit(event) {
    var form = event.target.closest("form[data-form]");
    if (!form) return;
    event.preventDefault();
    var kind = form.getAttribute("data-form");
    var data = new FormData(form);
    if (kind === "weight") {
      var value = number(data.get("weight"));
      if (value < 25) return showToast("Indica um peso válido.");
      state.weights.push({ id: makeId(), date: String(data.get("date") || dateKey(new Date())), weight: value });
      state.profile.weight = value;
      saveState();
      renderPage();
      return showToast("Peso registado.");
    }
    if (kind === "activity") {
      var mins = number(data.get("minutes"));
      if (mins < 1) return showToast("Indica a duração da atividade.");
      state.activities.push({ id: makeId(), date: dateKey(new Date()), name: String(data.get("name") || "").trim(), minutes: mins, calories: number(data.get("calories")) });
      saveState();
      renderPage();
      return showToast("Atividade registada.");
    }
    if (kind === "shopping") {
      var ingredient = String(data.get("name") || "").trim();
      if (ingredient) {
        state.shopping.push({ id: makeId(), name: ingredient, checked: false });
        saveState();
        renderPage();
        showToast("Adicionado à lista.");
      }
      return;
    }
    if (kind === "profile") {
      var oldWeight = number(state.profile.weight);
      state.profile = {
        name: String(data.get("name") || "").trim(),
        age: number(data.get("age")) || "",
        height: number(data.get("height")) || "",
        sex: String(data.get("sex") || ""),
        activityLevel: String(data.get("activityLevel") || ""),
        goal: String(data.get("goal") || ""),
        weight: number(data.get("weight")),
        targetWeight: number(data.get("targetWeight")) || "",
        calorieGoal: number(data.get("calorieGoal")),
        waterGoal: number(data.get("waterGoal")) || 2000,
        proteinGoal: number(data.get("proteinGoal")),
        carbsGoal: number(data.get("carbsGoal")),
        fatGoal: number(data.get("fatGoal"))
      };
      if (oldWeight !== state.profile.weight) state.weights.push({ id: makeId(), date: dateKey(new Date()), weight: state.profile.weight });
      saveState();
      renderPage();
      return showToast("As metas foram atualizadas.");
    }
  }

  function addWater(amount) {
    var value = number(amount);
    if (value <= 0 || value > 5000) return showToast("Indica uma quantidade entre 1 e 5000 ml.");
    state.water.push({ id: makeId(), date: dateKey(new Date()), amount: value, time: Date.now() });
    saveState();
    renderPage();
    showToast(value + " ml de água registados.");
  }

  function startFast() {
    if (state.fast) return showToast("Já tens um temporizador ativo.");
    var hours = number(document.getElementById("fast-hours").value) || 12;
    state.fast = { startedAt: Date.now(), targetHours: hours };
    saveState();
    renderPage();
    showToast("Temporizador iniciado.");
  }

  function stopFast() {
    if (!state.fast) return;
    var duration = Math.max(0, (Date.now() - state.fast.startedAt) / 3600000);
    state.fastHistory.push({ id: makeId(), date: dateKey(new Date(state.fast.startedAt)), duration: duration, targetHours: state.fast.targetHours, completed: duration >= state.fast.targetHours });
    state.fast = null;
    saveState();
    renderPage();
    showToast("Registo do temporizador concluído.");
  }

  function updateFastClock() {
    var nodes = document.querySelectorAll("[data-fast-clock]");
    if (!nodes.length || !state.fast) return;
    var elapsed = Math.max(0, Date.now() - state.fast.startedAt);
    var h = Math.floor(elapsed / 3600000);
    var m = Math.floor((elapsed % 3600000) / 60000);
    var s = Math.floor((elapsed % 60000) / 1000);
    var value = [h, m, s].map(function (part) { return String(part).padStart(2, "0"); }).join(":");
    nodes.forEach(function (node) { node.textContent = value; });
  }

  function addRecipeToList(recipeId) {
    var recipe = recipes.find(function (item) { return item.id === recipeId; });
    if (!recipe) return;
    var count = 0;
    recipe.ingredients.forEach(function (name) {
      var exists = state.shopping.some(function (item) { return item.name.toLowerCase() === name.toLowerCase(); });
      if (!exists) {
        state.shopping.push({ id: makeId(), name: name, checked: false });
        count += 1;
      }
    });
    saveState();
    renderPage();
    showToast(count ? count + " ingredientes adicionados." : "Os ingredientes já estão na lista.");
  }

  function exportData() {
    var payload = { exportedAt: new Date().toISOString(), application: "NutriAI — demonstração local", data: state };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "nutriai-dados-" + dateKey(new Date()) + ".json";
    link.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    showToast("Cópia dos dados exportada.");
  }

  function handleAction(actionEl) {
    var action = actionEl.getAttribute("data-action");
    var id = actionEl.getAttribute("data-id");
    if (action === "add-meal") return openMealDialog();
    if (action === "prev-day" || action === "next-day") {
      var date = parseDate(viewDate);
      date.setDate(date.getDate() + (action === "prev-day" ? -1 : 1));
      viewDate = dateKey(date);
      return renderPage();
    }
    if (action === "delete-meal") {
      state.meals = state.meals.filter(function (meal) { return meal.id !== id; });
      saveState(); renderPage(); return showToast("Registo removido.");
    }
    if (action === "add-water") return addWater(actionEl.getAttribute("data-amount"));
    if (action === "custom-water") {
      var amount = window.prompt("Quantos mililitros queres registar?");
      if (amount !== null) addWater(amount.replace(",", "."));
      return;
    }
    if (action === "start-fast") return startFast();
    if (action === "stop-fast") return stopFast();
    if (action === "add-recipe") return addRecipeToList(actionEl.getAttribute("data-recipe"));
    if (action === "delete-activity") {
      state.activities = state.activities.filter(function (item) { return item.id !== id; });
      saveState(); renderPage(); return showToast("Atividade removida.");
    }
    if (action === "delete-weight") {
      state.weights = state.weights.filter(function (item) { return item.id !== id; });
      saveState(); renderPage(); return showToast("Registo de peso removido.");
    }
    if (action === "toggle-shopping") {
      var item = state.shopping.find(function (entry) { return entry.id === id; });
      if (item) item.checked = !item.checked;
      saveState(); renderPage(); return;
    }
    if (action === "delete-shopping") {
      state.shopping = state.shopping.filter(function (item) { return item.id !== id; });
      saveState(); renderPage(); return showToast("Ingrediente removido.");
    }
    if (action === "clear-shopping") {
      if (window.confirm("Queres limpar toda a lista de compras?")) {
        state.shopping = []; saveState(); renderPage(); showToast("Lista limpa.");
      }
      return;
    }
    if (action === "export") return exportData();
    if (action === "clear-data") {
      if (window.confirm("Apagar todos os registos guardados neste navegador? Esta ação não pode ser desfeita.")) {
        localStorage.removeItem(STORAGE_KEY);
        state = loadState();
        openProfileDialog();
        renderPage();
      }
      return;
    }
  }

  document.getElementById("side-nav").addEventListener("click", function (event) {
    var button = event.target.closest("[data-page]");
    if (button) setPage(button.getAttribute("data-page"));
  });
  document.getElementById("mobile-nav").addEventListener("click", function (event) {
    var button = event.target.closest("[data-page]");
    if (button) setPage(button.getAttribute("data-page"));
  });
  pageContent.addEventListener("click", function (event) {
    var pageButton = event.target.closest("[data-page]");
    if (pageButton) return setPage(pageButton.getAttribute("data-page"));
    var action = event.target.closest("[data-action]");
    if (action) handleAction(action);
  });
  pageContent.addEventListener("submit", handleFormSubmit);
  document.getElementById("profile-form").addEventListener("submit", handleProfileSubmit);
  document.getElementById("meal-form").addEventListener("submit", handleMealSubmit);
  document.getElementById("meal-photo").addEventListener("change", handlePhotoChange);
  document.getElementById("lookup-barcode").addEventListener("click", lookupBarcode);
  document.getElementById("dictate-meal").addEventListener("click", startDictation);
  document.getElementById("edit-profile").addEventListener("click", openProfileDialog);
  document.getElementById("theme-toggle").addEventListener("click", function () {
    state.dark = !state.dark; saveState(); renderPage();
  });
  document.querySelectorAll("[data-close-profile]").forEach(function (button) { button.addEventListener("click", function () { if (state.profile) closeDialog(profileDialog); }); });
  document.querySelectorAll("[data-close-meal]").forEach(function (button) { button.addEventListener("click", function () { closeDialog(mealDialog); }); });
  profileDialog.addEventListener("cancel", function (event) { if (!state.profile) event.preventDefault(); });
  profileDialog.addEventListener("click", function (event) { if (event.target === profileDialog && state.profile) closeDialog(profileDialog); });
  mealDialog.addEventListener("click", function (event) { if (event.target === mealDialog) closeDialog(mealDialog); });
  window.addEventListener("resize", function () { if ((state.currentPage || "home") === "progress") drawWeightChart(); });

  renderPage();
  if (!state.profile) openProfileDialog();
  setInterval(updateFastClock, 1000);
})();
