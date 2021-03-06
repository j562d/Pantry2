var Recipe = require('../models/recipe');
var User = require('../models/user');
var request = require('request');
const rootURL = 'https://spoonacular-recipe-food-nutrition-v1.p.mashape.com';

module.exports = {
  show: show,
  addFav: addFav,
  index: index,
  removeFav: removeFav,
  createReview: createReview,
  newReview: newReview,
  deleteReview: deleteReview
};

function index(req, res, next) {
  getPopulatedUser(req.user._id)
  .then(user => res.render('recipes/index', {user: req.user, recipes: user.favorites}));
}

function show(req, res, next) {
	var query = (req.params.recipeId.length < 24) ?
		{recipeId: req.params.recipeId} : {_id: req.params.recipeId};
	Recipe.findOne(query).populate('reviews.reviewer').exec(function (err, recipe) {
    if(recipe) {
  		res.render('recipes/show', {user: req.user, recipe});
    } else {
      addRecipeToDb(req.params.recipeId)
      .then(function(recipe) {
        res.render('recipes/show', {user: req.user, recipe});
      });
    }
	})
}

function addFav(req, res, next) {
  Recipe.findOne({recipeId: req.params.recipeId}, function(err, recipe) {
    if (recipe) {
      if (!req.user.favorites.some(fav => fav.equals(recipe._id))) {
        req.user.favorites.push(recipe._id);
        console.log(recipe._id)
        req.user.save(function(err) {
          getPopulatedUser(req.user._id)
          .then(user => res.render('recipes/index', {user: req.user, recipes: user.favorites}));
        });
      } else {
        getPopulatedUser(req.user._id)
        .then(user => res.render('recipes/index', {user: req.user, recipes: user.favorites}));
      } ;
    } else {
    addRecipeToDb(req.params.recipeId)
    .then(recipe => {
      req.user.favorites.push(recipe._id);
      req.user.save(function(err) {
        getPopulatedUser(req.user._id)
        .then(user => res.render('recipes/index', {user: req.user, recipes: user.favorites}));
      });
    });
    }
  });
}

function removeFav(req, res, next) {
  req.user.favorites.splice(req.user.favorites.indexOf(req.params.id), 1);
  req.user.save(function(err) {
    res.json({msg: 'Deleted favorite'});
  })
}

function deleteReview(req, res) {
  Recipe.findById(req.params.recId, function(err, recipe) { 
    recipe.reviews.splice(recipe.reviews.indexOf(req.params.revId), 1);
    recipe.save(function (err, d) {
      res.json({msg: 'Deleted review'});
    });
 });
}

// helper functions
function getPopulatedUser(userId) {
  return User.findById(userId).populate('favorites').exec();
};

function addRecipeToDb (recipeApiId) {
  var nutTitle, amount, unit;
  var nutArr = [];
  var options = {
    url: rootURL +'/recipes/' + recipeApiId + '/information?includeNutrition=true',
    headers: {
      'X-Mashape-Key': process.env.SPOONACULAR_TOKEN,
      'Accept': 'application/json'
    }
  };
  return new Promise(function(resolve, reject) {
    request.get(options, function(err, response, body) {
      var recipeData = JSON.parse(body);
       var newRecipe = new Recipe({
        title: recipeData.title,
        recipeId: recipeData.id,
        directions: recipeData.instructions,
        cookingMinutes: recipeData.cookingMinutes,
        preparationMinutes: recipeData.preparationMinutes,
        readyInMinutes: recipeData.readyInMinutes,
        servingSize: recipeData.servings,
        imageUrl: recipeData.image
      });
      recipeData.extendedIngredients.forEach(function(ing) {
        newRecipe.ingredients.push({
          name: ing.name,
          amount: ing.amount,
          unit: ing.unit
        });
      });
      recipeData.nutrition.nutrients.forEach(function(nut) {
        newRecipe.nutrients.push({
          title: nut.title,
          amount: nut.amount,
          unit: nut.unit
        });
      });
      resolve(newRecipe);
    });
  }).then(function(recipe) {
    return recipe.save();
  });
}

function newReview(req, res, next) {
    res.render('recipes/comments');
}

function createReview(req, res, next) {
 Recipe.findById(req.params.id, function(err, recipe) {
  req.body.reviewer = req.user._id;
  recipe.reviews.push(req.body);
  recipe.save(function (err, d) {
    if (err) return res.render('/');
      res.redirect('/recipes/' + req.params.id);
    });
 });
}
