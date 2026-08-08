jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return {
    FontAwesome6: ({ color, name, size }) =>
      React.createElement(Text, { style: { color, fontSize: size } }, name),
  };
});
