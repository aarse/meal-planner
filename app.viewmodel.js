/**
 * Helpers
 */

// Bypass CORS
var cors_api_url = 'https://cors-anywhere.herokuapp.com/';
function doCORSRequest(options, printResult) {
	var x = new XMLHttpRequest();
	x.open(options.method, cors_api_url + options.url);
	x.onload = x.onerror = function() {
		printResult(x.responseText);
	};
	if (/^POST/i.test(options.method)) {
		x.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
	}
	x.send(options.data);
}

// Strip HTML
function strip(html){
   var doc = new DOMParser().parseFromString(html, 'text/html');
   return doc.body.textContent || "";
}

// Check if value is a number
function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}


// Fraction to number
function fractionToNumber(x) {
	var y = x.split(' ');
	if(y.length > 1){
	    var z = y[1].split('/');
	    return(+y[0] + (z[0] / z[1]));
	}
	else{
	    var z = y[0].split('/');
	    if(z.length > 1){
	        return(z[0] / z[1]);
	    }
	    else{
	        return(z[0]);
	    }
	}
}

/**
 * App ViewModel
 */
var MealPlanner = function() {
	var self = this;
	self.days = ko.observableArray(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
	self.meals = ko.observableArray(['Breakfast','Lunch','Dinner']);

	/**
	 * Data Model
	 */
	//@todo: Each day+meal combination is its own observableArray - a computed would be better
	self.updateShoppingList = ko.observable(); // Nested observables are hard to track...
	self.recipes = {};
	self.setup = function(meal_plan) {
		self.days().forEach(function(day){
			self.recipes[day] = {};
			self.meals().forEach(function(meal){
				self.recipes[day][meal] = ko.observableArray();
			});
		});
	}
	// Drag & Drop
    self.drop = function (data, model) {
    	self.updateShoppingList(Math.random());
    	self.recipes[model.day][model.meal].push(data)
    }

	/**
	 * Search
	 */
	self.searchText = ko.observable().extend({ throttle: 500 });
	self.searchResults = ko.observableArray();
	self.searching = ko.observable(false);
	self.search = function( text ) {
		self.searching(true);
		doCORSRequest({
	        method: 'GET',
	        url: 'https://toh.test.rda.net/wp-json/wp/v2/recipe/?search=' + text // www is cached by varnish...
	      }, function printResult(result) {
	      	self.searchResults(JSON.parse(result));
			self.searching(false);
	      });
	}
	self.searchText.subscribe(self.search);


	/**
	 * Shopping List
	 */
	self.shoppingList = ko.computed(function(){
	 	self.updateShoppingList();
	 	var ingredients = {};
	 	Object.keys(self.recipes).forEach(function (day) {
			Object.keys(self.recipes[day]).forEach(function (meal) {
				recipes_for_day_and_meal = self.recipes[day][meal]();
				recipes_for_day_and_meal.forEach(function(recipe){
					recipe.rms_legacy_data.Ingredients.forEach(function(ingredient){
						// Some fractions are represented as "1-1/2" meaning 1 AND 1/2. Parser recognizes "1 1/2"
						ingredient_text = ingredient.Ingredient.replace(/([0-9]+)-([0-9]+\/[0-9]+)/gm, '$1 $2')

						// Parse ingredient info
						ingredient_info = IngredientsParser.parse(ingredient_text);
						ingredient_name = strip(ingredient_info.ingredient)

						// Some ingredients don't have units (e.g. "3 eggs")
						unit = '';
						if ( ingredient_info && ingredient_info.unit)
							unit = ingredient_info.unit;

						// Some don't have amounts (e.g. "blueberries")
						amount = '';
						if (ingredient_info && ingredient_info.amount)
							amount = ingredient_info.amount;

						// Some "Ingredients" in the database are actually titles... e.g. "<b>For the topping</b>"
						if ( unit || amount ) {
							if ( ! (ingredient_name + unit in ingredients) ) {
								ingredients[ingredient_name + unit] = ingredient_info;
								ingredients[ingredient_name + unit].amount = 0;
								ingredients[ingredient_name + unit].unit = unit;
							}

							if ( isNumeric(amount) ) {
								ingredients[ingredient_name + unit].amount += parseFloat(amount);
							} else {
								// god help us
								// or maybe convert fractions to floats and then back to fractions
								ingredients[ingredient_name + unit].amount += fractionToNumber(amount);
							}
						}
					});
				});
			});
		});

		// @todo: convert back 0.3333333333 to 1/3 :)
		return Object.values(ingredients);
	}, self);

	// UI
	self.toggleShoppingList = function() {
		document.getElementById('shopping-list').classList.toggle('collapsed');
	}
	// Startup
	self.setup();
}
ko.applyBindings(new MealPlanner());
